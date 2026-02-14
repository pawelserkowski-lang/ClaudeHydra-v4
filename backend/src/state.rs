use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use crate::models::{AppSettings, Session, WitcherAgent};

pub type SharedState = Arc<Mutex<AppState>>;

pub struct AppState {
    pub settings: AppSettings,
    pub agents: Vec<WitcherAgent>,
    pub sessions: Vec<Session>,
    pub current_session_id: Option<String>,
    pub api_keys: HashMap<String, String>,
    pub start_time: Instant,
    pub client: reqwest::Client,
}

impl AppState {
    pub fn new() -> Self {
        let mut api_keys = HashMap::new();
        if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
            api_keys.insert("ANTHROPIC_API_KEY".to_string(), key);
        }
        if let Ok(key) = std::env::var("GOOGLE_API_KEY") {
            api_keys.insert("GOOGLE_API_KEY".to_string(), key);
        }

        let settings = AppSettings {
            theme: "dark".to_string(),
            language: "en".to_string(),
            default_model: "claude-sonnet-4-5-20250929".to_string(),
            auto_start: false,
        };

        let agents = init_witcher_agents();

        Self {
            settings,
            agents,
            sessions: Vec::new(),
            current_session_id: None,
            api_keys,
            start_time: Instant::now(),
            client: reqwest::Client::new(),
        }
    }
}

fn model_for_tier(tier: &str) -> &'static str {
    match tier {
        "Commander" => "claude-opus-4-6",
        "Coordinator" => "claude-sonnet-4-5-20250929",
        "Executor" => "claude-haiku-4-5-20251001",
        _ => "claude-sonnet-4-5-20250929",
    }
}

fn init_witcher_agents() -> Vec<WitcherAgent> {
    let defs: &[(&str, &str, &str, &str)] = &[
        ("Geralt",    "Security",      "Commander",  "Master witcher and security specialist — hunts vulnerabilities like monsters"),
        ("Yennefer",  "Architecture",  "Commander",  "Powerful sorceress of system architecture — designs elegant magical structures"),
        ("Vesemir",   "Testing",       "Commander",  "Veteran witcher mentor — rigorously tests and validates all operations"),
        ("Triss",     "Data",          "Coordinator","Skilled sorceress of data management — weaves information with precision"),
        ("Jaskier",   "Documentation", "Coordinator","Legendary bard — chronicles every detail with flair and accuracy"),
        ("Ciri",      "Performance",   "Coordinator","Elder Blood carrier — optimises performance with dimensional speed"),
        ("Dijkstra",  "Strategy",      "Coordinator","Spymaster strategist — plans operations with cunning intelligence"),
        ("Lambert",   "DevOps",        "Executor",   "Bold witcher — executes deployments and infrastructure operations"),
        ("Eskel",     "Backend",       "Executor",   "Steady witcher — builds and maintains robust backend services"),
        ("Regis",     "Research",      "Executor",   "Scholarly higher vampire — researches and analyses with ancient wisdom"),
        ("Zoltan",    "Frontend",      "Executor",   "Dwarven warrior — forges powerful and resilient frontend interfaces"),
        ("Philippa",  "Monitoring",    "Executor",   "All-seeing sorceress — monitors systems with her magical owl familiar"),
    ];

    defs.iter()
        .enumerate()
        .map(|(i, (name, role, tier, desc))| WitcherAgent {
            id: format!("agent-{:03}", i + 1),
            name: name.to_string(),
            role: role.to_string(),
            tier: tier.to_string(),
            status: "active".to_string(),
            description: desc.to_string(),
            model: model_for_tier(tier).to_string(),
        })
        .collect()
}
