# Changelog

## [1.0.3] - 2024-02-13

### Changed
- Replaced modal popup for new numbers with a toggle switch below paste area
- Default behavior set to add new numbers to existing calculation
- Fixed automatic sum calculation when adding new numbers
- Latest results now appear at the top of history

## [1.0.2] - 2024-02-12

### Added
- Individual number editing functionality with edit button at top left of each number
- Individual number copy functionality with copy button at bottom center of each number
- Improved number editing UX with keyboard support (Enter to save, Escape to cancel)

### Changed
- Updated number display UI to accommodate new edit and copy controls
- Improved operator selector styling and default value handling

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