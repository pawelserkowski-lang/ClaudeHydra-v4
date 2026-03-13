// Jaskier Shared Pattern — Web Tools v2
// Comprehensive web scraping tools with 50 improvements:
// SSRF prevention, robots.txt, sitemap, concurrent crawl, HTML tables/code/links,
// metadata extraction (OG, JSON-LD, canonical), retry with backoff, content dedup,
// URL normalization, configurable options, JSON output format.
//
// Now delegates to shared jaskier-tools::web module.

use serde_json::{Value, json};

use crate::models::ToolDefinition;
use crate::state::AppState;

pub use jaskier_tools::web::types::*;
use jaskier_tools::web::{fetch, crawl};

// ═══════════════════════════════════════════════════════════════════════════
//  Tool definitions
// ═══════════════════════════════════════════════════════════════════════════

pub fn tool_definitions() -> Vec<ToolDefinition> {
    vec![
        ToolDefinition {
            name: "fetch_webpage".to_string(),
            description: "Fetch a web page with full content extraction. Returns clean text \
                (HTML stripped, tables as markdown, code blocks preserved), page metadata \
                (title, description, language, OpenGraph, JSON-LD, canonical URL), and \
                categorized links (internal/external/resource). Supports custom headers, \
                retry with backoff, and SSRF protection. Use for reading articles, docs, \
                blog posts, or any web content."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Full URL to fetch (http or https)"
                    },
                    "extract_links": {
                        "type": "boolean",
                        "description": "Extract and categorize all links (default: true)"
                    },
                    "extract_metadata": {
                        "type": "boolean",
                        "description": "Extract OG tags, JSON-LD, canonical URL, language (default: true)"
                    },
                    "include_images": {
                        "type": "boolean",
                        "description": "Include image alt-text descriptions in output (default: false)"
                    },
                    "output_format": {
                        "type": "string",
                        "enum": ["text", "json"],
                        "description": "Output format: 'text' (markdown-like) or 'json' (structured). Default: text"
                    },
                    "max_text_length": {
                        "type": "integer",
                        "description": "Truncate extracted text to N characters (summary mode)"
                    },
                    "headers": {
                        "type": "object",
                        "description": "Custom HTTP headers to send (e.g. {\"Authorization\": \"Bearer ...\"})"
                    }
                },
                "required": ["url"]
            }),
        },
        ToolDefinition {
            name: "crawl_website".to_string(),
            description: "Crawl a website with concurrent fetching, robots.txt compliance, \
                sitemap discovery, and intelligent link following. Extracts text and metadata \
                from each page, detects duplicate content via hashing, categorizes all links. \
                Supports path prefix filtering, exclude patterns, configurable concurrency, \
                rate limiting, and total time limit. Returns aggregated content with link index. \
                Use for reading documentation sites, multi-page articles, or mapping website \
                structure."
                .to_string(),
            input_schema: json!({
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Starting URL to crawl (http or https)"
                    },
                    "max_depth": {
                        "type": "integer",
                        "description": "Max link depth to follow (default: 2, max: 5)"
                    },
                    "max_pages": {
                        "type": "integer",
                        "description": "Max pages to fetch (default: 10, max: 50)"
                    },
                    "same_domain_only": {
                        "type": "boolean",
                        "description": "Only follow links on same domain (default: true)"
                    },
                    "path_prefix": {
                        "type": "string",
                        "description": "Only follow URLs whose path starts with this prefix (e.g. '/docs/')"
                    },
                    "exclude_patterns": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Skip URLs containing any of these substrings (e.g. ['/api/', '/admin/'])"
                    },
                    "respect_robots_txt": {
                        "type": "boolean",
                        "description": "Fetch and respect robots.txt rules (default: true)"
                    },
                    "use_sitemap": {
                        "type": "boolean",
                        "description": "Discover pages from sitemap.xml (default: true)"
                    },
                    "concurrent_requests": {
                        "type": "integer",
                        "description": "Number of concurrent requests (default: 3, max: 5)"
                    },
                    "delay_ms": {
                        "type": "integer",
                        "description": "Delay between request batches in ms (default: 300)"
                    },
                    "max_total_seconds": {
                        "type": "integer",
                        "description": "Total crawl time limit in seconds (default: 120, max: 180)"
                    },
                    "output_format": {
                        "type": "string",
                        "enum": ["text", "json"],
                        "description": "Output format: 'text' or 'json'. Default: text"
                    },
                    "max_text_length": {
                        "type": "integer",
                        "description": "Max text chars per page (default: 3000)"
                    },
                    "include_metadata": {
                        "type": "boolean",
                        "description": "Include page metadata in output (default: true)"
                    },
                    "headers": {
                        "type": "object",
                        "description": "Custom HTTP headers for all requests"
                    }
                },
                "required": ["url"]
            }),
        },
    ]
}

// ═══════════════════════════════════════════════════════════════════════════
//  Dispatcher
// ═══════════════════════════════════════════════════════════════════════════

pub async fn execute(tool_name: &str, input: &Value, state: &AppState) -> (String, bool) {
    match tool_name {
        "fetch_webpage" => match fetch::tool_fetch_webpage(input, &state.http_client).await {
            Ok(text) => (text, false),
            Err(e) => (format!("TOOL_ERROR: {}", e), true),
        },
        "crawl_website" => match crawl::tool_crawl_website(input, &state.http_client).await {
            Ok(text) => (text, false),
            Err(e) => (format!("TOOL_ERROR: {}", e), true),
        },
        _ => (format!("Unknown web tool: {}", tool_name), true),
    }
}
