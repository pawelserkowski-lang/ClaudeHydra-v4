use std::path::{Path, PathBuf};

use serde_json::Value;

use super::{
    is_binary, is_blocked_for_write, BLOCKED_BACKUP_EXTENSIONS, DEFAULT_BLOCKED_WRITE_PREFIXES,
    DEFAULT_MAX_DEPTH, DEFAULT_MAX_LINES, DEFAULT_MAX_RESULTS, MAX_READ_BYTES, MAX_WRITE_BYTES,
};

// ── Path validation ─────────────────────────────────────────────────────

pub fn validate_path(raw: &str, allowed_dirs: &[PathBuf]) -> Result<PathBuf, String> {
    // ── #6 Path traversal hardening ─────────────────────────────────
    // Block null bytes (can truncate paths in C-backed syscalls)
    if raw.contains('\0') {
        return Err("Access denied: path contains null byte".to_string());
    }

    // Block Windows alternate data streams (filename:stream)
    if raw.contains(':') && !raw.starts_with("\\\\?\\") {
        // Allow drive letter like C:\... but block anything with a second colon
        let after_drive = if raw.len() >= 2 && raw.as_bytes()[1] == b':' {
            &raw[2..]
        } else {
            raw
        };
        if after_drive.contains(':') {
            return Err("Access denied: NTFS alternate data streams are not allowed".to_string());
        }
    }

    // Block UNC paths (\\server\share)
    if raw.starts_with("\\\\") || raw.starts_with("//") {
        return Err("Access denied: UNC network paths are not allowed".to_string());
    }

    // Block paths ending with ~ (vim swap indicator)
    if raw.ends_with('~') {
        return Err(
            "Access denied: temporary/backup paths (ending with ~) are not allowed".to_string(),
        );
    }

    // Block backup extensions
    if let Some(ext) = Path::new(raw).extension().and_then(|e| e.to_str()) {
        let lower = ext.to_lowercase();
        if BLOCKED_BACKUP_EXTENSIONS.contains(&lower.as_str()) {
            return Err(format!(
                "Access denied: backup extension '.{}' is not allowed",
                lower
            ));
        }
    }

    let path = PathBuf::from(raw);

    // Resolve to absolute — if relative, resolve against first allowed dir
    let abs = if path.is_absolute() {
        path
    } else if let Some(base) = allowed_dirs.first() {
        base.join(&path)
    } else {
        return Err("No allowed directories configured".to_string());
    };

    // Canonicalize for path traversal protection (resolve .. etc)
    // For files that don't exist yet, canonicalize the parent
    let canonical = if abs.exists() {
        abs.canonicalize()
            .map_err(|e| format!("Cannot resolve path: {}", e))?
    } else {
        let parent = abs
            .parent()
            .ok_or_else(|| "Invalid path: no parent directory".to_string())?;
        if !parent.exists() {
            return Err(format!(
                "Parent directory does not exist: {}",
                parent.display()
            ));
        }
        let canonical_parent = parent
            .canonicalize()
            .map_err(|e| format!("Cannot resolve parent: {}", e))?;
        canonical_parent.join(abs.file_name().unwrap_or_default())
    };

    // Check if canonical path is within any allowed directory
    let in_allowed = allowed_dirs.iter().any(|dir| {
        if let Ok(canon_dir) = dir.canonicalize() {
            canonical.starts_with(&canon_dir)
        } else {
            false
        }
    });

    if !in_allowed {
        return Err(format!(
            "Access denied: path '{}' is outside allowed directories",
            canonical.display()
        ));
    }

    Ok(canonical)
}

// `is_blocked_for_write` and `is_binary` are imported from jaskier_tools::files::validator
// via super:: re-exports. The shared versions contain identical logic for:
// - Dangerous extension blocking (exe, dll, env, key, pem, etc.)
// - .env / .env.* file blocking
// - .git directory blocking
// - Credential filename blocking
// - System prefix blocking
// - Binary data detection (null-byte heuristic in first 8 KiB)

// ── read_file ───────────────────────────────────────────────────────────

pub async fn exec_read_file(input: &Value, allowed_dirs: &[PathBuf]) -> (String, bool) {
    let raw_path = match input.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return ("Missing required parameter: path".to_string(), true),
    };

    let path = match validate_path(raw_path, allowed_dirs) {
        Ok(p) => p,
        Err(e) => return (e, true),
    };

    if !path.is_file() {
        return (format!("Not a file: {}", path.display()), true);
    }

    // Check file size
    let metadata = match std::fs::metadata(&path) {
        Ok(m) => m,
        Err(e) => return (format!("Cannot read metadata: {}", e), true),
    };

    if metadata.len() > MAX_READ_BYTES {
        return (
            format!(
                "File too large: {} bytes (max {} MB)",
                metadata.len(),
                MAX_READ_BYTES / 1_048_576
            ),
            true,
        );
    }

    let bytes = match std::fs::read(&path) {
        Ok(b) => b,
        Err(e) => return (format!("Cannot read file: {}", e), true),
    };

    if is_binary(&bytes) {
        return (
            format!(
                "Binary file detected: {} ({} bytes)",
                path.display(),
                bytes.len()
            ),
            true,
        );
    }

    let content = String::from_utf8_lossy(&bytes);
    let max_lines = input
        .get("max_lines")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_MAX_LINES as u64) as usize;

    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len();

    if total <= max_lines {
        (content.into_owned(), false)
    } else {
        let truncated: String = lines[..max_lines].join("\n");
        (
            format!(
                "{}\n\n[... truncated: showing {}/{} lines]",
                truncated, max_lines, total
            ),
            false,
        )
    }
}

// ── list_directory ──────────────────────────────────────────────────────

pub async fn exec_list_directory(input: &Value, allowed_dirs: &[PathBuf]) -> (String, bool) {
    let raw_path = match input.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return ("Missing required parameter: path".to_string(), true),
    };

    let path = match validate_path(raw_path, allowed_dirs) {
        Ok(p) => p,
        Err(e) => return (e, true),
    };

    if !path.is_dir() {
        return (format!("Not a directory: {}", path.display()), true);
    }

    let recursive = input
        .get("recursive")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    let max_depth = input
        .get("max_depth")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_MAX_DEPTH as u64) as usize;

    let mut entries = Vec::new();
    list_dir_recursive(&path, &path, recursive, max_depth, 0, &mut entries);

    if entries.is_empty() {
        return ("Directory is empty".to_string(), false);
    }

    (entries.join("\n"), false)
}

fn list_dir_recursive(
    base: &Path,
    dir: &Path,
    recursive: bool,
    max_depth: usize,
    current_depth: usize,
    out: &mut Vec<String>,
) {
    let mut items: Vec<_> = match std::fs::read_dir(dir) {
        Ok(rd) => rd.filter_map(|e| e.ok()).collect(),
        Err(e) => {
            out.push(format!("[error reading {}: {}]", dir.display(), e));
            return;
        }
    };

    items.sort_by_key(|e| e.file_name());

    for entry in items {
        let ft = match entry.file_type() {
            Ok(ft) => ft,
            Err(_) => continue,
        };

        let rel = entry
            .path()
            .strip_prefix(base)
            .unwrap_or(&entry.path())
            .to_string_lossy()
            .to_string();

        if ft.is_dir() {
            out.push(format!("[DIR]  {}/", rel));
            if recursive && current_depth < max_depth {
                list_dir_recursive(base, &entry.path(), true, max_depth, current_depth + 1, out);
            }
        } else {
            let size = entry.metadata().map(|m| m.len()).unwrap_or(0);
            let size_str = if size < 1024 {
                format!("{} B", size)
            } else if size < 1_048_576 {
                format!("{:.1} KB", size as f64 / 1024.0)
            } else {
                format!("{:.1} MB", size as f64 / 1_048_576.0)
            };
            out.push(format!("[FILE] {} ({})", rel, size_str));
        }
    }
}

// ── write_file ──────────────────────────────────────────────────────────

pub async fn exec_write_file(input: &Value, allowed_dirs: &[PathBuf]) -> (String, bool) {
    let raw_path = match input.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return ("Missing required parameter: path".to_string(), true),
    };
    let content = match input.get("content").and_then(|v| v.as_str()) {
        Some(c) => c,
        None => return ("Missing required parameter: content".to_string(), true),
    };
    let create_dirs = input
        .get("create_dirs")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if content.len() > MAX_WRITE_BYTES {
        return (
            format!(
                "Content too large: {} bytes (max {} MB)",
                content.len(),
                MAX_WRITE_BYTES / 1_048_576
            ),
            true,
        );
    }

    // For write, we need to validate the parent directory exists (or create it)
    let abs_path = {
        let p = PathBuf::from(raw_path);
        if p.is_absolute() {
            p
        } else if let Some(base) = allowed_dirs.first() {
            base.join(&p)
        } else {
            return ("No allowed directories configured".to_string(), true);
        }
    };

    if create_dirs
        && let Some(parent) = abs_path.parent()
        && !parent.exists()
        && let Err(e) = std::fs::create_dir_all(parent)
    {
        return (format!("Failed to create directories: {}", e), true);
    }

    let path = match validate_path(raw_path, allowed_dirs) {
        Ok(p) => p,
        Err(e) => return (e, true),
    };

    if is_blocked_for_write(&path, DEFAULT_BLOCKED_WRITE_PREFIXES) {
        return (
            format!(
                "Write blocked: cannot write to '{}' (restricted extension)",
                path.display()
            ),
            true,
        );
    }

    // Create backup if file exists
    if path.is_file() {
        let bak = path.with_extension(format!(
            "{}.bak",
            path.extension().and_then(|e| e.to_str()).unwrap_or("txt")
        ));
        if let Err(e) = std::fs::copy(&path, &bak) {
            tracing::warn!("Could not create backup {}: {}", bak.display(), e);
        }
    }

    match std::fs::write(&path, content) {
        Ok(()) => (
            format!("Written {} bytes to {}", content.len(), path.display()),
            false,
        ),
        Err(e) => (format!("Failed to write file: {}", e), true),
    }
}

// ── search_in_files ─────────────────────────────────────────────────────

pub async fn exec_search_in_files(input: &Value, allowed_dirs: &[PathBuf]) -> (String, bool) {
    let raw_path = match input.get("path").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return ("Missing required parameter: path".to_string(), true),
    };
    let pattern_str = match input.get("pattern").and_then(|v| v.as_str()) {
        Some(p) => p,
        None => return ("Missing required parameter: pattern".to_string(), true),
    };

    let path = match validate_path(raw_path, allowed_dirs) {
        Ok(p) => p,
        Err(e) => return (e, true),
    };

    if !path.is_dir() {
        return (format!("Not a directory: {}", path.display()), true);
    }

    let re = match regex::Regex::new(pattern_str) {
        Ok(r) => r,
        Err(e) => return (format!("Invalid regex pattern: {}", e), true),
    };

    let file_glob = input
        .get("file_glob")
        .and_then(|v| v.as_str())
        .unwrap_or("**/*");
    let max_results = input
        .get("max_results")
        .and_then(|v| v.as_u64())
        .unwrap_or(DEFAULT_MAX_RESULTS as u64) as usize;

    let glob_pattern = format!("{}/{}", path.display(), file_glob);
    let glob_entries = match glob::glob(&glob_pattern) {
        Ok(entries) => entries,
        Err(e) => return (format!("Invalid glob pattern: {}", e), true),
    };

    let mut results = Vec::new();
    let mut total_matches = 0usize;

    for entry in glob_entries.flatten() {
        if !entry.is_file() {
            continue;
        }

        // Skip binary / huge files
        let meta = match std::fs::metadata(&entry) {
            Ok(m) => m,
            Err(_) => continue,
        };
        if meta.len() > MAX_READ_BYTES {
            continue;
        }

        let bytes = match std::fs::read(&entry) {
            Ok(b) => b,
            Err(_) => continue,
        };
        if is_binary(&bytes) {
            continue;
        }

        let content = String::from_utf8_lossy(&bytes);
        let rel = entry
            .strip_prefix(&path)
            .unwrap_or(&entry)
            .to_string_lossy()
            .to_string();

        for (line_num, line) in content.lines().enumerate() {
            if re.is_match(line) {
                total_matches += 1;
                if results.len() < max_results {
                    results.push(format!("{}:{}: {}", rel, line_num + 1, line.trim()));
                }
            }
        }
    }

    if results.is_empty() {
        return (
            format!(
                "No matches found for pattern '{}' in {}",
                pattern_str,
                path.display()
            ),
            false,
        );
    }

    let mut output = results.join("\n");
    if total_matches > max_results {
        output.push_str(&format!(
            "\n\n[... showing {}/{} matches]",
            max_results, total_matches
        ));
    }

    (output, false)
}
