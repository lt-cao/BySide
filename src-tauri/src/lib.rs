use image::{ColorType, ImageDecoder, ImageReader};
use serde::Serialize;
use std::fs;
use std::io::Cursor;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Mutex;
use tauri::{Manager, State};

#[cfg(target_os = "macos")]
use tauri::Emitter;

const MAX_IMAGE_BYTES: u64 = 512 * 1024 * 1024;
const ALLOWED_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "ico",
];

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageMetadata {
    file_name: String,
    width: u32,
    height: u32,
    color_space: &'static str,
    dpi: Option<u32>,
    mime_type: &'static str,
    file_size: u64,
}

#[derive(Default)]
struct PendingOpenFiles(Mutex<Vec<String>>);

fn validated_image_path(path: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    let metadata = fs::metadata(&path).map_err(|_| "Không tìm thấy file ảnh.".to_string())?;
    if !metadata.is_file() {
        return Err("Đường dẫn đã chọn không phải là một file.".to_string());
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("Ảnh vượt quá giới hạn 512 MB.".to_string());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "File không có phần mở rộng ảnh hợp lệ.".to_string())?;
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Định dạng ảnh chưa được hỗ trợ.".to_string());
    }
    Ok(path)
}

#[tauri::command]
fn inspect_image(app_handle: tauri::AppHandle, path: String) -> Result<ImageMetadata, String> {
    let metadata = inspect_image_path(&path)?;
    app_handle
        .asset_protocol_scope()
        .allow_file(&path)
        .map_err(|_| "Không thể cấp quyền hiển thị file ảnh.".to_string())?;
    Ok(metadata)
}

fn inspect_image_path(path: &str) -> Result<ImageMetadata, String> {
    let path = validated_image_path(path)?;
    let file_size = fs::metadata(&path)
        .map_err(|_| "Không đọc được thông tin file.".to_string())?
        .len();
    let bytes = fs::read(&path).map_err(|_| "Không đọc được dữ liệu ảnh.".to_string())?;
    let reader = ImageReader::new(Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|_| "Không nhận diện được định dạng ảnh.".to_string())?;
    let format = reader.format();
    let decoder = reader
        .into_decoder()
        .map_err(|_| "File ảnh bị hỏng hoặc định dạng chưa được hỗ trợ.".to_string())?;
    let (width, height) = decoder.dimensions();
    let color = decoder.color_type();

    Ok(ImageMetadata {
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Không có tên file")
            .to_string(),
        width,
        height,
        color_space: color_space(color),
        dpi: parse_dpi(&bytes),
        mime_type: mime_type(&path, format),
        file_size,
    })
}

#[tauri::command]
fn take_opened_files(state: State<'_, PendingOpenFiles>) -> Vec<String> {
    let mut paths = state.0.lock().unwrap_or_else(|error| error.into_inner());
    std::mem::take(&mut *paths)
}

#[tauri::command]
fn open_with_other_app(path: String) -> Result<(), String> {
    let path = validated_image_path(&path)?;

    #[cfg(target_os = "macos")]
    {
        let chooser = Command::new("osascript")
            .args([
                "-e",
                "set chosenApp to choose file with prompt \"Chọn ứng dụng để mở ảnh\" of type \"com.apple.application-bundle\" default location path to applications folder",
                "-e",
                "return POSIX path of chosenApp",
            ])
            .output()
            .map_err(|_| "Không thể mở danh sách ứng dụng.".to_string())?;

        if !chooser.status.success() {
            let message = String::from_utf8_lossy(&chooser.stderr);
            return if message.contains("-128") {
                Ok(())
            } else {
                Err("Không thể chọn ứng dụng khác.".to_string())
            };
        }

        let application = String::from_utf8_lossy(&chooser.stdout).trim().to_string();
        if application.is_empty() {
            return Ok(());
        }
        Command::new("open")
            .arg("-a")
            .arg(application)
            .arg(path)
            .spawn()
            .map_err(|_| "Không thể mở ảnh bằng ứng dụng đã chọn.".to_string())?;
        return Ok(());
    }

    #[cfg(target_os = "windows")]
    {
        Command::new("rundll32.exe")
            .arg("shell32.dll,OpenAs_RunDLL")
            .arg(path)
            .spawn()
            .map_err(|_| "Không thể mở danh sách ứng dụng.".to_string())?;
        return Ok(());
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Command::new("xdg-open")
            .arg(path)
            .spawn()
            .map_err(|_| "Không thể mở ảnh bằng ứng dụng khác.".to_string())?;
        Ok(())
    }
}

fn color_space(color: ColorType) -> &'static str {
    match color {
        ColorType::L8 | ColorType::La8 | ColorType::L16 | ColorType::La16 => "Gray",
        ColorType::Rgb8
        | ColorType::Rgba8
        | ColorType::Rgb16
        | ColorType::Rgba16
        | ColorType::Rgb32F
        | ColorType::Rgba32F => "RGB",
        _ => "Color --",
    }
}

fn mime_type(path: &Path, format: Option<image::ImageFormat>) -> &'static str {
    match format.or_else(|| image::ImageFormat::from_path(path).ok()) {
        Some(image::ImageFormat::Png) => "image/png",
        Some(image::ImageFormat::Jpeg) => "image/jpeg",
        Some(image::ImageFormat::Gif) => "image/gif",
        Some(image::ImageFormat::WebP) => "image/webp",
        Some(image::ImageFormat::Bmp) => "image/bmp",
        Some(image::ImageFormat::Tiff) => "image/tiff",
        Some(image::ImageFormat::Ico) => "image/x-icon",
        _ => "application/octet-stream",
    }
}

fn parse_dpi(bytes: &[u8]) -> Option<u32> {
    if bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]) {
        parse_png_dpi(bytes)
    } else if bytes.starts_with(&[0xff, 0xd8]) {
        parse_jpeg_dpi(bytes)
    } else if bytes.starts_with(b"II\x2a\0") || bytes.starts_with(b"MM\0\x2a") {
        parse_exif_dpi(bytes, 0)
    } else if bytes.starts_with(b"BM") {
        parse_bmp_dpi(bytes)
    } else if bytes.starts_with(b"RIFF") && bytes.get(8..12) == Some(b"WEBP") {
        parse_webp_dpi(bytes)
    } else {
        None
    }
}

fn parse_png_dpi(bytes: &[u8]) -> Option<u32> {
    let mut offset = 8usize;
    while offset.checked_add(12)? <= bytes.len() {
        let length = be_u32(bytes, offset)? as usize;
        let data = offset.checked_add(8)?;
        let end = data.checked_add(length)?.checked_add(4)?;
        if end > bytes.len() {
            return None;
        }
        let chunk_type = bytes.get(offset + 4..offset + 8)?;
        if chunk_type == b"pHYs" && length >= 9 && bytes[data + 8] == 1 {
            let x_ppm = be_u32(bytes, data)? as f64;
            let y_ppm = be_u32(bytes, data + 4)? as f64;
            if let Some(dpi) = density_to_dpi(x_ppm, y_ppm, 0.0254) {
                return Some(dpi);
            }
        } else if chunk_type == b"eXIf" && length >= 8 {
            let tiff = if bytes.get(data..data + 6) == Some(b"Exif\0\0") {
                data + 6
            } else {
                data
            };
            if let Some(dpi) = parse_exif_dpi(bytes, tiff) {
                return Some(dpi);
            }
        }
        if chunk_type == b"IEND" {
            break;
        }
        offset = end;
    }
    None
}

fn parse_jpeg_dpi(bytes: &[u8]) -> Option<u32> {
    let mut offset = 2usize;
    let mut jfif_dpi = None;
    while offset.checked_add(4)? <= bytes.len() {
        if bytes[offset] != 0xff {
            offset += 1;
            continue;
        }
        let marker = bytes[offset + 1];
        if marker == 0xd9 || marker == 0xda {
            break;
        }
        if (0xd0..=0xd7).contains(&marker) {
            offset += 2;
            continue;
        }
        let length = be_u16(bytes, offset + 2)? as usize;
        if length < 2 || offset.checked_add(2)?.checked_add(length)? > bytes.len() {
            break;
        }
        let data = offset + 4;
        if marker == 0xe0 && length >= 16 && bytes.get(data..data + 5) == Some(b"JFIF\0") {
            let unit = bytes[data + 7];
            let x = be_u16(bytes, data + 8)? as f64;
            let y = be_u16(bytes, data + 10)? as f64;
            jfif_dpi = match unit {
                1 => density_to_dpi(x, y, 1.0),
                2 => density_to_dpi(x, y, 2.54),
                _ => jfif_dpi,
            };
        } else if marker == 0xe1 && length >= 14 && bytes.get(data..data + 6) == Some(b"Exif\0\0") {
            if let Some(dpi) = parse_exif_dpi(bytes, data + 6) {
                return Some(dpi);
            }
        }
        offset += 2 + length;
    }
    jfif_dpi
}

fn parse_exif_dpi(bytes: &[u8], tiff: usize) -> Option<u32> {
    let byte_order = bytes.get(tiff..tiff + 2)?;
    let little = match byte_order {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };
    if read_u16(bytes, tiff + 2, little)? != 42 {
        return None;
    }

    let mut ifd = tiff.checked_add(read_u32(bytes, tiff + 4, little)? as usize)?;
    let mut x_resolution = None;
    let mut y_resolution = None;
    let mut unit = 2u16;

    for _ in 0..8 {
        let count = read_u16(bytes, ifd, little)? as usize;
        for index in 0..count {
            let entry = ifd.checked_add(2)?.checked_add(index.checked_mul(12)?)?;
            let tag = read_u16(bytes, entry, little)?;
            let field_type = read_u16(bytes, entry + 2, little)?;
            let value_count = read_u32(bytes, entry + 4, little)?;
            if (tag == 0x011a || tag == 0x011b) && field_type == 5 && value_count > 0 {
                let rational = tiff.checked_add(read_u32(bytes, entry + 8, little)? as usize)?;
                let numerator = read_u32(bytes, rational, little)? as f64;
                let denominator = read_u32(bytes, rational + 4, little)? as f64;
                if denominator > 0.0 {
                    if tag == 0x011a {
                        x_resolution = Some(numerator / denominator);
                    } else {
                        y_resolution = Some(numerator / denominator);
                    }
                }
            } else if tag == 0x0128 && field_type == 3 && value_count > 0 {
                unit = read_u16(bytes, entry + 8, little)?;
            }
        }

        if x_resolution.is_some() || y_resolution.is_some() {
            break;
        }
        let next = ifd.checked_add(2)?.checked_add(count.checked_mul(12)?)?;
        let relative = read_u32(bytes, next, little)? as usize;
        if relative == 0 {
            break;
        }
        ifd = tiff.checked_add(relative)?;
    }

    let factor = match unit {
        2 => 1.0,
        3 => 2.54,
        _ => return None,
    };
    density_to_dpi(
        x_resolution.unwrap_or(0.0),
        y_resolution.unwrap_or(0.0),
        factor,
    )
}

fn parse_bmp_dpi(bytes: &[u8]) -> Option<u32> {
    if read_u32_le(bytes, 14)? < 40 {
        return None;
    }
    let x_ppm = read_i32_le(bytes, 38)? as f64;
    let y_ppm = read_i32_le(bytes, 42)? as f64;
    density_to_dpi(x_ppm, y_ppm, 0.0254)
}

fn parse_webp_dpi(bytes: &[u8]) -> Option<u32> {
    let mut offset = 12usize;
    while offset.checked_add(8)? <= bytes.len() {
        let chunk_type = bytes.get(offset..offset + 4)?;
        let length = read_u32_le(bytes, offset + 4)? as usize;
        let data = offset.checked_add(8)?;
        let end = data.checked_add(length)?;
        if end > bytes.len() {
            return None;
        }
        if chunk_type == b"EXIF" {
            let tiff = if bytes.get(data..data + 6) == Some(b"Exif\0\0") {
                data + 6
            } else {
                data
            };
            return parse_exif_dpi(bytes, tiff);
        }
        offset = end.checked_add(length % 2)?;
    }
    None
}

fn density_to_dpi(x: f64, y: f64, factor: f64) -> Option<u32> {
    let average = match (x.is_finite() && x > 0.0, y.is_finite() && y > 0.0) {
        (true, true) => (x + y) / 2.0,
        (true, false) => x,
        (false, true) => y,
        (false, false) => return None,
    };
    let dpi = (average * factor).round();
    if (1.0..=1_000_000.0).contains(&dpi) {
        Some(dpi as u32)
    } else {
        None
    }
}

fn be_u16(bytes: &[u8], offset: usize) -> Option<u16> {
    Some(u16::from_be_bytes(
        bytes.get(offset..offset + 2)?.try_into().ok()?,
    ))
}

fn be_u32(bytes: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_be_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

fn read_u16(bytes: &[u8], offset: usize, little: bool) -> Option<u16> {
    let value: [u8; 2] = bytes.get(offset..offset + 2)?.try_into().ok()?;
    Some(if little {
        u16::from_le_bytes(value)
    } else {
        u16::from_be_bytes(value)
    })
}

fn read_u32(bytes: &[u8], offset: usize, little: bool) -> Option<u32> {
    let value: [u8; 4] = bytes.get(offset..offset + 4)?.try_into().ok()?;
    Some(if little {
        u32::from_le_bytes(value)
    } else {
        u32::from_be_bytes(value)
    })
}

fn read_u32_le(bytes: &[u8], offset: usize) -> Option<u32> {
    Some(u32::from_le_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

fn read_i32_le(bytes: &[u8], offset: usize) -> Option<i32> {
    Some(i32::from_le_bytes(
        bytes.get(offset..offset + 4)?.try_into().ok()?,
    ))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(PendingOpenFiles::default())
        .invoke_handler(tauri::generate_handler![
            inspect_image,
            take_opened_files,
            open_with_other_app
        ])
        .build(tauri::generate_context!())
        .expect("error while building Tauri application");

    app.run(|_app_handle, _event| {
        #[cfg(target_os = "macos")]
        if let tauri::RunEvent::Opened { urls } = _event {
            let paths = urls
                .iter()
                .filter_map(|url| url.to_file_path().ok())
                .filter(|path| path.is_file())
                .filter_map(|path| {
                    let _ = _app_handle.asset_protocol_scope().allow_file(&path);
                    path.to_str().map(ToOwned::to_owned)
                })
                .collect::<Vec<_>>();

            if !paths.is_empty() {
                let state = _app_handle.state::<PendingOpenFiles>();
                state
                    .0
                    .lock()
                    .unwrap_or_else(|error| error.into_inner())
                    .extend(paths);
                let _ = _app_handle.emit("open-image-files", ());
                if let Some(window) = _app_handle.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    fn little_endian_tiff_dpi(dpi: u32) -> Vec<u8> {
        let mut bytes = vec![0u8; 66];
        bytes[0..2].copy_from_slice(b"II");
        bytes[2..4].copy_from_slice(&42u16.to_le_bytes());
        bytes[4..8].copy_from_slice(&8u32.to_le_bytes());
        bytes[8..10].copy_from_slice(&3u16.to_le_bytes());

        for (entry, tag, rational_offset) in [(10usize, 0x011au16, 50u32), (22, 0x011b, 58)] {
            bytes[entry..entry + 2].copy_from_slice(&tag.to_le_bytes());
            bytes[entry + 2..entry + 4].copy_from_slice(&5u16.to_le_bytes());
            bytes[entry + 4..entry + 8].copy_from_slice(&1u32.to_le_bytes());
            bytes[entry + 8..entry + 12].copy_from_slice(&rational_offset.to_le_bytes());
        }

        bytes[34..36].copy_from_slice(&0x0128u16.to_le_bytes());
        bytes[36..38].copy_from_slice(&3u16.to_le_bytes());
        bytes[38..42].copy_from_slice(&1u32.to_le_bytes());
        bytes[42..44].copy_from_slice(&2u16.to_le_bytes());
        bytes[50..54].copy_from_slice(&dpi.to_le_bytes());
        bytes[54..58].copy_from_slice(&1u32.to_le_bytes());
        bytes[58..62].copy_from_slice(&dpi.to_le_bytes());
        bytes[62..66].copy_from_slice(&1u32.to_le_bytes());
        bytes
    }

    #[test]
    fn reads_png_pixels_per_meter() {
        let mut bytes = vec![0u8; 66];
        bytes[0..8].copy_from_slice(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]);
        bytes[8..12].copy_from_slice(&13u32.to_be_bytes());
        bytes[12..16].copy_from_slice(b"IHDR");
        let offset = 33;
        bytes[offset..offset + 4].copy_from_slice(&9u32.to_be_bytes());
        bytes[offset + 4..offset + 8].copy_from_slice(b"pHYs");
        bytes[offset + 8..offset + 12].copy_from_slice(&3780u32.to_be_bytes());
        bytes[offset + 12..offset + 16].copy_from_slice(&3780u32.to_be_bytes());
        bytes[offset + 16] = 1;
        assert_eq!(parse_dpi(&bytes), Some(96));
    }

    #[test]
    fn reads_jfif_dpi() {
        let mut bytes = vec![0u8; 22];
        bytes[0..2].copy_from_slice(&[0xff, 0xd8]);
        bytes[2..4].copy_from_slice(&[0xff, 0xe0]);
        bytes[4..6].copy_from_slice(&16u16.to_be_bytes());
        bytes[6..11].copy_from_slice(b"JFIF\0");
        bytes[13] = 1;
        bytes[14..16].copy_from_slice(&300u16.to_be_bytes());
        bytes[16..18].copy_from_slice(&300u16.to_be_bytes());
        assert_eq!(parse_dpi(&bytes), Some(300));
    }

    #[test]
    fn reads_tiff_resolution_tags() {
        assert_eq!(parse_dpi(&little_endian_tiff_dpi(240)), Some(240));
    }

    #[test]
    fn reads_png_exif_resolution() {
        let tiff = little_endian_tiff_dpi(144);
        let mut bytes = Vec::new();
        bytes.extend_from_slice(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]);
        bytes.extend_from_slice(&(tiff.len() as u32).to_be_bytes());
        bytes.extend_from_slice(b"eXIf");
        bytes.extend_from_slice(&tiff);
        bytes.extend_from_slice(&[0; 4]);
        assert_eq!(parse_dpi(&bytes), Some(144));
    }

    #[test]
    fn reads_bmp_pixels_per_meter() {
        let mut bytes = vec![0u8; 54];
        bytes[0..2].copy_from_slice(b"BM");
        bytes[14..18].copy_from_slice(&40u32.to_le_bytes());
        bytes[38..42].copy_from_slice(&11_811i32.to_le_bytes());
        bytes[42..46].copy_from_slice(&11_811i32.to_le_bytes());
        assert_eq!(parse_dpi(&bytes), Some(300));
    }

    #[test]
    fn inspects_the_real_application_icon() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../public/app-icon.png")
            .to_string_lossy()
            .to_string();
        let metadata = inspect_image_path(&path).expect("the application icon should be readable");
        assert_eq!((metadata.width, metadata.height), (1024, 1024));
        assert_eq!(metadata.mime_type, "image/png");
        assert_eq!(metadata.color_space, "RGB");
    }
}
