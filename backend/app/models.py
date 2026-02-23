from pydantic import BaseModel

class TextRequest(BaseModel):
    text: str

class FullProcessRequest(BaseModel):
    prompt: str