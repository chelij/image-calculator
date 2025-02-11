# Image Calculator

A desktop application that extracts numbers from images and performs calculations on them. Perfect for quickly processing numbers from screenshots, photos, or any image source.

## Features

- Extract numbers from images using OCR
- Support for different number formats:
  - Configurable thousand separators (comma, period, space, or none)
  - Configurable decimal points (comma, period, or none)
  - Special mode for processing numbers in separate rows
- Basic calculator operations (+, -, ×, ÷)
- History tracking
- Copy results to clipboard
- Dark mode UI

## Installation

### Download

Download the latest release from the [releases page](https://github.com/yourusername/image-calculator/releases).

Available versions:
- Windows: `Image Calculator Setup.exe` (installer) or `Image Calculator.exe` (portable)
- macOS: Coming soon
- Linux: Coming soon

### Build from Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/image-calculator.git
cd image-calculator
```

2. Install dependencies:
```bash
npm install
```

3. Run in development mode:
```bash
npm run dev
```

4. Build for production:
```bash
npm run pack:win  # for Windows
npm run pack:mac  # for macOS
npm run pack:linux  # for Linux
```

## Usage

1. Launch the application
2. Configure your number format preferences:
   - Set your preferred thousand separator
   - Set your preferred decimal point
   - Enable "Numbers in separate rows" if needed
3. Take a screenshot of numbers you want to calculate
4. Paste (Ctrl+V) the screenshot into the application
5. Adjust operators between numbers if needed
6. Click Calculate
7. Copy the result or view calculation history

## Development

### Prerequisites

- Node.js 18+
- npm 9+
- Electron 28+

### Project Structure

```
image-calculator/
├── src/
│   ├── components/     # React components
│   ├── styles.css     # Global styles
│   ├── main.js        # Electron main process
│   └── index.jsx      # React entry point
├── assets/
│   └── tessdata/      # OCR training data
└── dist/              # Build output
```

## License

MIT License - see LICENSE file for details 