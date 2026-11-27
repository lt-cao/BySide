use image::{ImageDecoder, ImageReader};
use serde::Serialize;
use std::ffi::{CStr, CString};
use std::fs;
use std::os::raw::c_char;
use std::path::Path;

const MAX_IMAGE_BYTES: u64 = 512 * 1024 * 1024;
const ALLOWED_EXTENSIONS: &[&str] = &[
    "png", "jpg", "jpeg", "webp", "gif", "bmp", "tif", "tiff", "ico",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ImageMetadata {
    ok: bool,
    file_name: String,
    width: u32,
    height: u32,
    color_space: String,
    dpi: Option<u32>,
    file_size: u64,
    error: Option<String>,
}

impl ImageMetadata {
    fn error(message: impl Into<String>) -> Self {
        Self {
            ok: false,
            file_name: String::new(),
            width: 0,
            height: 0,
            color_space: String::new(),
            dpi: None,
            file_size: 0,
            error: Some(message.into()),
        }
    }
}

fn inspect(path: &Path) -> Result<ImageMetadata, String> {
    let metadata = fs::metadata(path).map_err(|_| "Không tìm thấy file ảnh.".to_string())?;
    if !metadata.is_file() {
        return Err("Đường dẫn đã chọn không phải là một file.".into());
    }
    if metadata.len() > MAX_IMAGE_BYTES {
        return Err("Ảnh vượt quá giới hạn 512 MB.".into());
    }
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "File không có phần mở rộng ảnh hợp lệ.".to_string())?;
    if !ALLOWED_EXTENSIONS.contains(&extension.as_str()) {
        return Err("Định dạng ảnh chưa được hỗ trợ.".into());
    }
    let bytes = fs::read(path).map_err(|_| "Không đọc được dữ liệu ảnh.".to_string())?;
    let reader = ImageReader::new(std::io::Cursor::new(&bytes))
        .with_guessed_format()
        .map_err(|_| "Không nhận diện được định dạng ảnh.".to_string())?;
    let decoder = reader
        .into_decoder()
        .map_err(|_| "File ảnh bị hỏng hoặc định dạng chưa được hỗ trợ.".to_string())?;
    let (width, height) = decoder.dimensions();
    let color_space = match decoder.color_type() {
        image::ColorType::L8
        | image::ColorType::La8
        | image::ColorType::L16
        | image::ColorType::La16 => "Gray",
        image::ColorType::Rgb8
        | image::ColorType::Rgba8
        | image::ColorType::Rgb16
        | image::ColorType::Rgba16
        | image::ColorType::Rgb32F
        | image::ColorType::Rgba32F => "RGB",
        _ => "Color --",
    };
    Ok(ImageMetadata {
        ok: true,
        file_name: path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Không có tên file")
            .to_string(),
        width,
        height,
        color_space: color_space.into(),
        dpi: parse_dpi(&bytes),
        file_size: metadata.len(),
        error: None,
    })
}

fn parse_dpi(bytes: &[u8]) -> Option<u32> {
    if bytes.starts_with(b"\x89PNG\r\n\x1a\n") {
        parse_png_dpi(bytes)
    } else if bytes.starts_with(&[0xff, 0xd8]) {
        parse_jpeg_dpi(bytes)
    } else if bytes.starts_with(b"BM") {
        let x = i32::from_le_bytes(bytes.get(38..42)?.try_into().ok()?) as f64;
        let y = i32::from_le_bytes(bytes.get(42..46)?.try_into().ok()?) as f64;
        density_to_dpi(x, y, 0.0254)
    } else {
        None
    }
}

fn parse_png_dpi(bytes: &[u8]) -> Option<u32> {
    let mut offset = 8usize;
    while offset.checked_add(12)? <= bytes.len() {
        let length = u32::from_be_bytes(bytes.get(offset..offset + 4)?.try_into().ok()?) as usize;
        let data = offset.checked_add(8)?;
        let end = data.checked_add(length)?.checked_add(4)?;
        if end > bytes.len() {
            return None;
        }
        if bytes.get(offset + 4..offset + 8)? == b"pHYs" && length >= 9 && bytes[data + 8] == 1 {
            let x = u32::from_be_bytes(bytes.get(data..data + 4)?.try_into().ok()?) as f64;
            let y = u32::from_be_bytes(bytes.get(data + 4..data + 8)?.try_into().ok()?) as f64;
            return density_to_dpi(x, y, 0.0254);
        }
        offset = end;
    }
    None
}

fn parse_jpeg_dpi(bytes: &[u8]) -> Option<u32> {
    let mut offset = 2usize;
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
        let length =
            u16::from_be_bytes(bytes.get(offset + 2..offset + 4)?.try_into().ok()?) as usize;
        if length < 2 || offset.checked_add(2)?.checked_add(length)? > bytes.len() {
            break;
        }
        let data = offset + 4;
        if marker == 0xe0 && length >= 16 && bytes.get(data..data + 5) == Some(b"JFIF\0") {
            let unit = bytes[data + 7];
            let x = u16::from_be_bytes(bytes.get(data + 8..data + 10)?.try_into().ok()?) as f64;
            let y = u16::from_be_bytes(bytes.get(data + 10..data + 12)?.try_into().ok()?) as f64;
            return match unit {
                1 => density_to_dpi(x, y, 1.0),
                2 => density_to_dpi(x, y, 2.54),
                _ => None,
            };
        }
        offset += 2 + length;
    }
    None
}

fn density_to_dpi(x: f64, y: f64, factor: f64) -> Option<u32> {
    let average = match (x > 0.0, y > 0.0) {
        (true, true) => (x + y) / 2.0,
        (true, false) => x,
        (false, true) => y,
        _ => return None,
    };
    let dpi = (average * factor).round();
    (1.0..=1_000_000.0).contains(&dpi).then_some(dpi as u32)
}

#[no_mangle]
pub unsafe extern "C" fn byside_inspect_image_json(path: *const c_char) -> *mut c_char {
    let result = if path.is_null() {
        ImageMetadata::error("Đường dẫn ảnh không hợp lệ.")
    } else {
        match CStr::from_ptr(path).to_str() {
            Ok(path) => inspect(Path::new(path)).unwrap_or_else(ImageMetadata::error),
            Err(_) => ImageMetadata::error("Đường dẫn ảnh không hợp lệ."),
        }
    };
    let json = serde_json::to_string(&result).unwrap_or_else(|_| {
        serde_json::to_string(&ImageMetadata::error("Không thể tạo metadata ảnh.")).unwrap()
    });
    CString::new(json)
        .expect("metadata JSON cannot contain NUL")
        .into_raw()
}

#[no_mangle]
pub unsafe extern "C" fn byside_free_string(pointer: *mut c_char) {
    if !pointer.is_null() {
        drop(CString::from_raw(pointer));
    }
}
