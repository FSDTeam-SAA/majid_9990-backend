# OCR + OpenAI IMEI Extraction API

This document describes the OCR (Optical Character Recognition) API that extracts IMEI numbers from uploaded images using Tesseract OCR and OpenAI's GPT model.

## Overview

The API accepts image files from the frontend, extracts text using **Tesseract.js**, and processes that text with **OpenAI** to identify and extract IMEI numbers.

## Features

- 🖼️ **Image Upload**: Accept image files (JPEG, PNG, WebP, AVIF)
- 🔤 **OCR Text Extraction**: Extract text from images using Tesseract.js
- 🤖 **AI-Powered IMEI Extraction**: Use OpenAI GPT to identify IMEI numbers
- ⏱️ **Performance Tracking**: Monitor processing time
- 🎯 **Confidence Levels**: Determine extraction confidence (high/medium/low)
- 🧹 **Auto Cleanup**: Automatically delete uploaded files after processing

## Installation & Setup

### 1. Install Dependencies

Dependencies are already installed:

```bash
npm install tesseract.js openai
```

### 2. Environment Variables

Add these variables to your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
```

Get your OpenAI API key from: https://platform.openai.com/api-keys

### 3. Start the Server

```bash
npm run dev
```

The API will be available at `http://localhost:5000`

## API Endpoint

### Extract IMEI from Image

**Endpoint:** `POST /api/ocr/extract-imei`

**Request:**

- Method: `POST`
- Content-Type: `multipart/form-data`
- Field Name: `image`
- Supported Formats: JPEG, PNG, WebP, AVIF
- Max File Size: 5MB

**Example Request (cURL):**

```bash
curl -X POST http://localhost:5000/api/ocr/extract-imei \
  -F "image=@/path/to/image.jpg"
```

**Example Request (JavaScript/Fetch):**

```javascript
const formData = new FormData();
formData.append('image', imageFile); // File object from input

const response = await fetch('http://localhost:5000/api/ocr/extract-imei', {
      method: 'POST',
      body: formData,
});

const result = await response.json();
console.log(result);
```

**Success Response (200):**

```json
{
      "success": true,
      "message": "IMEI extraction completed successfully",
      "data": {
            "rawText": "Device Information:\nIMEI: 123456789012345\nIMEI2: 987654321098765\nModel: iPhone 13...",
            "imeiNumbers": ["123456789012345", "987654321098765"],
            "confidence": "high",
            "processingTime": 2500
      }
}
```

**Error Response (400):**

```json
{
      "success": false,
      "message": "No image file provided"
}
```

**Error Response (500):**

```json
{
      "success": false,
      "message": "Failed to extract IMEI from image"
}
```

## Response Fields

| Field            | Type     | Description                                                                                      |
| ---------------- | -------- | ------------------------------------------------------------------------------------------------ |
| `rawText`        | string   | Full text extracted from the image by Tesseract OCR                                              |
| `imeiNumbers`    | string[] | Array of extracted IMEI numbers (15-digit strings)                                               |
| `confidence`     | string   | Confidence level: `high` (IMEIs found), `medium` (text found but no IMEIs), `low` (minimal text) |
| `processingTime` | number   | Total processing time in milliseconds                                                            |

## How It Works

### Step 1: Image Upload

Frontend sends image via multipart form-data to the API endpoint.

### Step 2: OCR Processing

Tesseract.js extracts all text from the image:

```
"Device Information:
IMEI: 123456789012345
Model: Device..."
```

### Step 3: AI Processing

OpenAI GPT-3.5 Turbo processes the extracted text to identify IMEI numbers:

- Understands IMEI format (15-digit strings)
- Filters out false positives
- Returns structured JSON array

### Step 4: Response & Cleanup

API returns results and automatically deletes the uploaded file.

## Processing Flow Diagram

```
Frontend
    ↓ (Upload Image)
API Endpoint
    ↓
Multer Middleware (Store file temporarily)
    ↓
OCR Service (Tesseract.js)
    ↓ (Extract text)
OpenAI Service (GPT-3.5 Turbo)
    ↓ (Extract IMEIs)
Response JSON
    ↓
File Cleanup
    ↓
Frontend Response
```

## Configuration Details

### Tesseract.js Configuration

- **Language**: English (`eng`)
- **Logger**: Console output for progress tracking

### OpenAI Configuration

- **Model**: `gpt-3.5-turbo`
- **Temperature**: 0.3 (Low randomness for consistent results)
- **System Prompt**: Specialized for IMEI extraction

### Multer Configuration

- **File Size Limit**: 5MB
- **Allowed Formats**: JPEG, PNG, WebP, AVIF, and others
- **Storage**: Disk storage in `/uploads` directory
- **Auto-Cleanup**: Files deleted after processing

## Testing

### Using Postman

1. Import `postman_ocr_collection.json`
2. Set `image` field to an image file
3. Send POST request to extract IMEI

### Manual Testing with cURL

```bash
curl -X POST http://localhost:5000/api/ocr/extract-imei \
  -F "image=@test-image.jpg"
```

### Testing with Test Image

Create a test image with IMEI text and upload to test the API.

## Error Handling

| Error                               | Status | Cause                            |
| ----------------------------------- | ------ | -------------------------------- |
| "No image file provided"            | 400    | Missing image file in request    |
| "Failed to extract IMEI from image" | 500    | OCR or OpenAI API error          |
| "Only supported files are allowed"  | 400    | Invalid file format or MIME type |

## Performance Considerations

- **First Request**: May take 3-5 seconds (Tesseract model loading)
- **Subsequent Requests**: Typically 1-3 seconds
- **OpenAI API**: Add network latency (usually 500ms-2s)
- **Total Average**: 2-5 seconds per image

## Cost Considerations

Each extraction uses:

1. **Tesseract.js**: Free (local processing)
2. **OpenAI API**: ~0.0005 USD per request (using gpt-3.5-turbo)

Estimated cost: ~$0.05 per 100 extractions

## Troubleshooting

### Issue: "OPENAI_API_KEY not found"

- **Solution**: Add `OPENAI_API_KEY` to `.env` file

### Issue: "Failed to extract text from image"

- **Solution**: Ensure image is clear and contains readable text

### Issue: No IMEIs detected

- **Solution**: Check if image clearly shows IMEI numbers; try a different image

### Issue: File size exceeded

- **Solution**: Use images smaller than 5MB

## Future Enhancements

- [ ] Add image preprocessing for better OCR accuracy
- [ ] Implement caching to reduce processing time
- [ ] Add batch processing for multiple images
- [ ] Support for additional document types (PDFs, scans)
- [ ] Advanced IMEI validation
- [ ] Processing queue for large volumes
- [ ] WebSocket for real-time progress updates

## Module Structure

```
src/modules/ocr/
├── ocr.controller.ts      # Request handler
├── ocr.service.ts         # Business logic (OCR + OpenAI)
├── ocr.interface.ts       # TypeScript interfaces
└── ocr.router.ts          # Route definitions
```

## Security Notes

- Files are automatically deleted after processing
- No file storage on server after completion
- OpenAI API key should be kept secure in `.env`
- File upload size limited to 5MB
- Only supported image formats allowed

## Integration Example

### Frontend (JavaScript)

```javascript
async function extractIMEI(imageFile) {
      const formData = new FormData();
      formData.append('image', imageFile);

      try {
            const response = await fetch('/api/ocr/extract-imei', {
                  method: 'POST',
                  body: formData,
            });

            const result = await response.json();

            if (result.success) {
                  console.log('Found IMEIs:', result.data.imeiNumbers);
                  console.log('Processing time:', result.data.processingTime + 'ms');
            } else {
                  console.error('Error:', result.message);
            }
      } catch (error) {
            console.error('Request failed:', error);
      }
}

// Usage
document.getElementById('imageInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) extractIMEI(file);
});
```

## Support & Documentation

For more information:

- Tesseract.js: https://github.com/naptha/tesseract.js
- OpenAI API: https://platform.openai.com/docs
- IMEI Format: https://en.wikipedia.org/wiki/International_Mobile_Equipment_Identity
