from pydantic_settings import BaseSettings, SettingsConfigDict
 
 
class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )
 
    # Mistral
    mistral_api_key: str = "mistral_api_key_here"
    mistral_base_url: str = "wss://api.mistral.ai"
    mistral_model: str = "voxtral-mini-transcribe-realtime-2602"
    groq_api_key: str = "grop_api_key_here"
    # Dual-delay defaults (milliseconds)
    fast_delay_ms: int = 240
    slow_delay_ms: int = 2400
 
    # Audio defaults
    sample_rate: int = 16000  # 8000 | 16000 | 22050 | 44100 | 48000
    chunk_duration_ms: int = 10
 
    # Server
    app_host: str = "0.0.0.0"
    app_port: int = 8000
    cors_origins: str = "http://localhost:5173"
 
    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]
 
 
settings = Settings()
