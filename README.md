# Thirukkural API

A modern, open-source API for the ancient Tamil literature Thirukkural (திருக்குறள்), consisting of 1330 couplets.

🌐 **Live API**: https://thirukkural-api.onrender.com  
📚 **Documentation**: https://thirukkural-api.onrender.com/api-docs

## Project Structure

```
data/
  ├── divisions.yml      # The three main divisions (பால் - paal)
  ├── sections.yml       # Sections within divisions (இயல் - iyal)
  ├── chapters.yml      # Chapters within sections (அதிகாரம் - adhikaram)
  └── couplets/         # Individual couplets (குறள் - kural)
      └── *.yml         # Couplet files (0001.yml to 1330.yml)
```

## Hierarchical Organization

1. **Division** (பால் / Paal)
   - Primary classification of the work
   - Three divisions:
     1. Virtue (அறத்துப்பால் / Araththuppaal)
     2. Wealth (பொருட்பால் / Porutpaal)
     3. Love (இன்பத்துப்பால் / Inbaththuppaal)

2. **Section** (இயல் / Iyal)
   - Groups of related chapters
   - Total of 133 sections
   - Example: Introduction (பாயிரவியல் / Paayiraviyal)

3. **Chapter** (அதிகாரம் / Adhikaram)
   - Groups of 10 couplets each
   - Total of 133 chapters
   - Example: Praise of God (கடவுள் வாழ்த்து / Kadavul Vaazhthu)

4. **Couplet** (குறள் / Kural)
   - Individual verses in Tamil
   - Two lines per couplet
   - Total of 1330 couplets
   - Rich metadata including:
     - Original Tamil text
     - Tamil explanation
     - Multiple translations
     - Traditional interpretations
     - Keywords for search

## Features

- **Comprehensive Data Structure**
  - Complete hierarchical organization
  - Original Tamil text with diacritics
  - Multiple translations and interpretations
  - Rich metadata and cross-references

- **Modern API Features**
  - RESTful endpoints with JSON responses
  - Pagination for large result sets
  - Advanced search capabilities
  - Filtering by division, section, and chapter
  - Comprehensive OpenAPI/Swagger documentation
  - CORS enabled for cross-origin requests
  - Input validation and error handling

- **Community Focus**
  - Multiple translations support
  - Traditional interpretations included
  - Contributor attribution
  - Open for community contributions

## Public API Usage

The API is freely available at `https://thirukkural-api.onrender.com`. No authentication required.

Example:
```bash
# Get a specific couplet
curl https://thirukkural-api.onrender.com/api/couplets/1

# Search couplets
curl https://thirukkural-api.onrender.com/api/couplets/search?q=friendship

# Get couplets by division (பால்)
curl https://thirukkural-api.onrender.com/api/couplets/search?division=1

# Get couplets by section (இயல்)
curl https://thirukkural-api.onrender.com/api/couplets/search?section=1

# Get couplets by chapter (அதிகாரம்)
curl https://thirukkural-api.onrender.com/api/couplets/search?chapter=1
```

Rate Limit: 100 requests per hour per IP address.

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/yourusername/thirukkural-api.git
cd thirukkural-api
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
\`\`\`

3. Start the development server:
\`\`\`bash
npm run dev
\`\`\`

The server will start on http://localhost:3000

### API Documentation

Visit http://localhost:3000/api-docs to view the Swagger documentation.

## API Endpoints

### 1. Get All Couplets
```http
GET /api/couplets?page=1&limit=10
```
Returns a paginated list of couplets with their translations and metadata.

### 2. Get Single Couplet
```http
GET /api/couplets/{number}
```
Returns detailed information about a specific couplet (1-1330).

### 3. Search Couplets
```http
GET /api/couplets/search
```
Search couplets with multiple filter options:
- `q`: Search term in text/translations
- `division`: Filter by division number (1-3)
- `section`: Filter by section number (1-133)
- `chapter`: Filter by chapter number (1-133)
- `page`: Page number for pagination
- `limit`: Results per page (max 100)

## Data Structure

### Couplet Object
```json
{
  "number": 1,
  "tamil": [
    "அகர முதல எழுத்தெல்லாம் ஆதி",
    "பகவன் முதற்றே உலகு"
  ],
  "tamil_explanation": "string",
  "division": {
    "number": 1,
    "name": "அறத்துப்பால்",
    "translation": "Book of Virtue",
    "transliteration": "Araththuppaal"
  },
  "translations": {
    "en": [
      {
        "text": "string",
        "explanation": "string",
        "author": "string",
        "year": 0
      }
    ]
  },
  "tamil_interpretations": [
    {
      "text": "string",
      "author": "string",
      "year": 0
    }
  ],
  "keywords": ["string"]
}
```

## Development

### Running Tests
```bash
npm test
```

### Building Database
```bash
npm run build:db
```

### Code Style
```bash
npm run lint
npm run format
```

## Contributing

1. Fork the repository
2. Create your feature branch
3. Add couplet data or code improvements
4. Run tests and linting
5. Submit a pull request

## License

This project is licensed under the ISC License.

## Acknowledgments

- Traditional commentators (உரையாசிரியர்கள்)
- Modern translators and scholars
- Open source community

- GET /api/kural - Get all Kurals
- GET /api/kural/:number - Get a specific Kural by number
- GET /api/kural/search?q=:searchTerm - Search Kurals by content

## Development

- Run tests: \`npm test\`
- Run linter: \`npm run lint\`
- Start development server with hot reload: \`npm run dev\`

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.