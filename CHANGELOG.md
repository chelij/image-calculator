# Changelog

## [1.0.1] - 2024-02-11

### Added
- New "Numbers in separate rows" mode for better handling of numbers in different lines
- "No decimal point" option in decimal point selector
- Enhanced image contrast processing for better OCR accuracy

### Fixed
- Improved decimal point and thousand separator detection
- Fixed incorrect comma/period handling in row-based mode
- Fixed resource loading issues with webpack configuration

### Changed
- Updated number processing logic to be more strict with decimal point handling
- Improved error messages and progress indicators
- Better handling of small/unclear images

## [1.0.0] - Initial Release

### Features
- OCR-based number extraction from images
- Support for different number formats (comma/period separators)
- Basic calculator functionality
- History tracking
- Copy results to clipboard
- Dark mode UI 