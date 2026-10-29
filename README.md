# DuesGuard AI 🚀

An Agentic AI-powered MSME payment intelligence and dispute preparation platform designed to automate delayed payment tracking, analyze financial documents, and generate evidence-ready dispute dossiers.

---

## 🌟 Overview

Small and Medium Enterprises (MSMEs) often face critical cash flow bottlenecks due to delayed payments and complex payment dispute resolutions. **DuesGuard AI** leverages autonomous multi-agent workflows, robust data validation, intelligent OCR, and voice integration to streamline payment tracking, flag risks early, and automatically compile legal- or dispute-ready documentation.

---

## ✨ Key Features

* **Multi-Agent Payment Tracking:** Utilizes intelligent agent workflows to coordinate tasks, monitor receivables, and follow up on overdue invoices proactively.
* **Intelligent OCR Document Processing:** Automatically extracts key financial data, invoice details, and transaction terms from uploaded receipts, bills, and purchase orders.
* **Automated Dispute Dossier Generation:** Compiles communication logs, payment histories, and extracted invoice evidence into a structured, evidence-ready dossier for legal or administrative dispute resolution.
* **Voice-Enabled Insights & Alerts:** Integrates voice synthesis to deliver dynamic, audio-based payment statuses, reminders, and summary briefings.
* **Structured Data Validation:** Powered by strict schema validation to ensure absolute accuracy in financial figures and metadata handling.

---

## 🛠️ Tech Stack & Architecture

* **Core Language:** Python
* **Agentic Workflows & Orchestration:** LangGraph, LangChain
* **Data Validation & Schemas:** Pydantic
* **Computer Vision / OCR:** OpenCV, PyTesseract / Custom OCR Pipelines
* **Voice Integration:** ElevenLabs API
* **Backend / Database:** FastAPI, SQLAlchemy / PostgreSQL or MySQL

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your system:
* Python 3.10+
* Git

### Installation & Setup

1. Clone the repository:
   ``bash
   git clone [https://github.com/Harsha31-chandra/DuesGuard.git](https://github.com/Harsha31-chandra/DuesGuard.git)
   cd DuesGuard

``

2. Create and activate a virtual environment:
``bash
python -m venv venv
source venv/bin/activate  # On Windows use: venv\Scripts\activate

```


3. Install dependencies:
```bash
pip install -r requirements.txt

```


4. Configure your environment variables:
Create a `.env` file in the root directory and add your required API keys:
'''env
OPENAI_API_KEY=your_openai_api_key_here
ELEVENLABS_API_KEY=your_elevenlabs_api_key_here
DATABASE_URL=your_database_connection_string_here







## 💻 Usage

Run the main application entry point or API server:

bash
uvicorn main:app --reload


Navigate to `http://localhost:8000/docs` to explore the interactive API documentation and test endpoints.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome! Feel free to check out the [issues page](https://www.google.com/search?q=https://github.com/Harsha31-chandra/DuesGuard/issues).

---



### 2. Run these commands in your VS Code terminal to upload it:

``bash
git add README.md
git commit -m "Add project README.md"
git push origin main

```
