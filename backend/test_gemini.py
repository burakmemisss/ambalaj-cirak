import asyncio
from app.services.gemini import extract_prices_from_pdf_vision, chat_with_gemini, PDF_PRICE_EXTRACTION_PROMPT, _vision_model, _parse_json_response

async def main():
    text = """Product Usage Paper Weight Cup Weight PRICE (1000 pcs) PRICE (1000 pcs)
100.000 50.000 30.000 20.000 10.000
4oz white paper cup (printed)(170gr)(HOT) Hot 170+18 PE 2,8 8,65 $ 9,52 $ 10,81 $ 11,25 $ 14,71 $
4oz white paper cup (printed)(190gr)(HOT) Hot 190+18 PE 3,1 9,20 $ 10,12 $ 11,50 $ 11,96 $ 15,64 $
7oz white paper cup (printed)(170gr)(HOT) Hot 170+18 PE 3,8 10,95 $ 12,05 $ 13,69 $ 14,24 $ 18,62 $"""
    
    prompt = f"""{PDF_PRICE_EXTRACTION_PROMPT}

Belge metni:
{text}"""
    
    print("Gemini'ye istek atılıyor...")
    response = _vision_model.generate_content([prompt])
    raw = response.text.strip()
    print("HAM YANIT:")
    print(raw)
    
    items = _parse_json_response(raw)
    print("\nAYRIŞTIRILAN JSON:")
    print(items)

if __name__ == "__main__":
    asyncio.run(main())
