# Image Calculator

A desktop application that extracts and processes numbers from images using OCR technology. Built with Electron and React, this application allows users to perform calculations on numbers found in images.

## Features

- Image upload and processing
- Optical Character Recognition (OCR) for number extraction
- Real-time calculation capabilities
- Cross-platform support (Windows, macOS, Linux)
- Modern and intuitive user interface

## Technology Stack

- **Frontend Framework**: React 18
- **Desktop Framework**: Electron
- **OCR Engine**: Tesseract.js
- **Build System**: Webpack
- **Package Management**: npm

## Installation

1. Clone the repository:
```bash
git clone https://github.com/chelij/image-calculator.git
cd image-calculator
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

For development mode with hot reloading:
```bash
npm run dev
```

## Building for Distribution

### Windows
```bash
npm run pack:win
```

### macOS
```bash
npm run pack:mac
```

### Linux
```bash
npm run pack:linux
```

Build outputs will be available in the `release` directory.

## Development

This project was developed using Claude 3.5 Sonnet in Cursor IDE, leveraging advanced AI capabilities for efficient and robust code development.

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request. 