use tauri::{AppHandle, Manager, Emitter};
use std::fs;
use rgb::FromSlice;
use image::GenericImageView;

#[derive(Clone, serde::Serialize)]
struct ImageProgress {
    card_id: String,
    status: String,
    progress: u8,
}

#[tauri::command]
async fn process_and_save_image(
    app: AppHandle,
    source_path: String,
    card_id: String,
    type_dir: String,
    thumb_size: u32,
) -> Result<(String, String), String> {
    let _ = app.emit("image-progress", ImageProgress { card_id: card_id.clone(), status: "Iniciando...".into(), progress: 10 });
    // Generate unique ID for the filename
    let unique_id = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_millis();
        
    let base_name = format!("{}_{}", card_id, unique_id);
    let orig_name = format!("{}.avif", base_name);
    let thumb_name = format!("{}_thumb.avif", base_name);
    
    // Paths
    let doc_dir = app.path().document_dir().map_err(|_| "Could not find document dir".to_string())?;
    let base_attach_dir = doc_dir.join("DevSnippets").join("attachments").join(&type_dir);
    let thumb_dir = base_attach_dir.join("thumb");
    
    fs::create_dir_all(&thumb_dir).map_err(|e| e.to_string())?;
    
    let dest_path = base_attach_dir.join(&orig_name);
    let thumb_dest_path = thumb_dir.join(&thumb_name);
    
    let app_clone = app.clone();
    let card_id_clone = card_id.clone();
    
    // CPU heavy task: Move to a blocking thread to avoid freezing Tauri UI/async runtime
    tauri::async_runtime::spawn_blocking(move || -> Result<(), String> {
        let image_bytes = fs::read(&source_path).map_err(|e| format!("Error leyendo archivo original: {}", e))?;
        let _ = app_clone.emit("image-progress", ImageProgress { card_id: card_id_clone.clone(), status: "Decodificando...".into(), progress: 30 });
        let mut img = image::load_from_memory(&image_bytes).map_err(|e| format!("Failed to decode image: {}", e))?;
        
        let _ = app_clone.emit("image-progress", ImageProgress { card_id: card_id_clone.clone(), status: "Convirtiendo HD (AVIF)...".into(), progress: 60 });
        // 1. Process Original (max 4K: 3840x2160)
        let (mut width, mut height) = img.dimensions();
        if width > 3840 || height > 2160 {
            img = img.resize(3840, 2160, image::imageops::FilterType::Lanczos3);
            let dims = img.dimensions();
            width = dims.0;
            height = dims.1;
        }
        
        let rgb_img = img.to_rgba8();
        let rgba_slice: &[rgb::RGBA8] = rgb_img.as_raw().as_rgba();
        let ravif_img = ravif::Img::new(rgba_slice, width as usize, height as usize);
        
        let encoded_orig = ravif::Encoder::new()
            .with_quality(75.0) // Adjusted for faster processing
            .with_speed(10) // MAX speed
            .encode_rgba(ravif_img)
            .map_err(|e| format!("Failed to encode original AVIF: {}", e))?;
            
        fs::write(&dest_path, encoded_orig.avif_file).map_err(|e| e.to_string())?;
        
        let _ = app_clone.emit("image-progress", ImageProgress { card_id: card_id_clone.clone(), status: "Convirtiendo miniatura...".into(), progress: 85 });
        // 2. Process Thumbnail
        let thumb = img.resize(thumb_size, thumb_size, image::imageops::FilterType::Lanczos3);
        let rgb_thumb = thumb.to_rgba8();
        let (tw, th) = rgb_thumb.dimensions();
        let rgba_thumb_slice: &[rgb::RGBA8] = rgb_thumb.as_raw().as_rgba();
        let ravif_thumb = ravif::Img::new(rgba_thumb_slice, tw as usize, th as usize);
        
        let encoded_thumb = ravif::Encoder::new()
            .with_quality(60.0) // Adjusted for thumb
            .with_speed(10) // MAX speed
            .encode_rgba(ravif_thumb)
            .map_err(|e| format!("Failed to encode thumb AVIF: {}", e))?;
            
        fs::write(&thumb_dest_path, encoded_thumb.avif_file).map_err(|e| e.to_string())?;
        
        let _ = app_clone.emit("image-progress", ImageProgress { card_id: card_id_clone.clone(), status: "Finalizado".into(), progress: 100 });
        Ok(())
    }).await.map_err(|e| format!("Thread failed: {}", e))??;
    
    // Relative paths to return
    let rel_path = format!("attachments/{}/{}", type_dir, orig_name);
    let thumb_rel_path = format!("attachments/{}/thumb/{}", type_dir, thumb_name);
    
    Ok((rel_path, thumb_rel_path))
}

#[tauri::command]
async fn convert_existing_image(
    app: AppHandle,
    relative_path: String,
) -> Result<(String, String), String> {
    if relative_path.starts_with("data:") {
        return Err("Cannot convert base64 data".to_string());
    }
    
    let doc_dir = app.path().document_dir().map_err(|_| "Could not find document dir".to_string())?;
    // relative_path is something like "attachments/media/image.jpg"
    let clean_rel = relative_path.replace("/", "\\");
    let abs_path = doc_dir.join("DevSnippets").join(&clean_rel);
    
    if !abs_path.exists() {
        return Err(format!("File does not exist: {:?}", abs_path));
    }
    
    // No necesitamos leer los bytes aquí: `process_and_save_image` volverá a leer el archivo.
    
    let path = std::path::Path::new(&relative_path);
    let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("migrated_img");
    let parent = path.parent().and_then(|p| p.to_str()).unwrap_or("attachments/media");
    
    let type_dir = if parent.contains("technical") { "technical".to_string() } else { "media".to_string() };
    let thumb_size = if type_dir == "media" { 512 } else { 256 };
    
    let (new_rel, new_thumb) = process_and_save_image(app.clone(), abs_path.to_string_lossy().to_string(), file_stem.to_string(), type_dir, thumb_size).await?;
    
    // Try to delete old file and old thumb
    let _ = fs::remove_file(&abs_path);
    
    let last_slash = relative_path.rfind('/');
    let last_dot = relative_path.rfind('.');
    if let (Some(slash), Some(dot)) = (last_slash, last_dot) {
        if dot > slash {
            let dir = &relative_path[..slash];
            let name = &relative_path[slash + 1..dot];
            let thumb_path = doc_dir.join("DevSnippets").join(dir).join("thumb").join(format!("{}_thumb.webp", name));
            let _ = fs::remove_file(thumb_path);
        }
    }
    
    Ok((new_rel, new_thumb))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .invoke_handler(tauri::generate_handler![process_and_save_image, convert_existing_image])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}