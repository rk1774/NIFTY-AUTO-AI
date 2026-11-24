# NIFTY AUTO AI V6 — App Starter

## इस ZIP में क्या है
- Android/लैपटॉप browser में खुलने वाला responsive dashboard prototype (`web/index.html`)
- Risk settings validation API
- Gap prediction input/output contract (research-only baseline)
- Dockerfile और FastAPI starter

## Android पर UI कैसे देखें
1. ZIP extract करें।
2. `web/index.html` को Chrome में खोलें।
3. Dashboard, Gap AI, Settings और Master Panel टैब देखें।

## API स्थानीय रूप से चलाना (डेवलपर चरण)
Python 3.12+:
```bash
pip install -r requirements.txt
uvicorn app.main:app --host 127.0.0.1 --port 8000
```
फिर `/docs` खोलें।

## अभी क्या काम नहीं करता
- यह deployed cloud server नहीं है।
- Angel One SmartAPI market data या order API जुड़ी नहीं है।
- कोई real-time signal, option chain selection, paper brokerage simulation या real order execution नहीं है।
- 3:15 PM scheduler/notification अभी सक्रिय नहीं है।
- Login/registration, subscriptions/AutoPay, admin authentication, multi-user persistence, audit log, MFA, backups और production security अभी नहीं हैं।
- Gap score केवल illustrative, uncalibrated baseline है; वास्तविक probability/forecast नहीं। Live data और ऐतिहासिक backtest के बिना इसे trade में इस्तेमाल न करें।
- Live trading hard-disabled है।

## मूल नियम
NIFTY 50 only; 5-minute; capital default ₹25,000; per-trade risk ₹600; daily loss ₹2,000; max 3 trades/day; max one open position; minimum score 75; capital range ₹0–₹10,00,000; naked option selling OFF.

## सुरक्षा
कभी भी API key, TOTP seed, trading PIN, access token या password इस ZIP, browser UI या chat में न डालें। Broker secrets को बाद में server-side encrypted secret store में रखा जाना चाहिए। इस starter को production trading के लिए deploy न करें।
