# Changelog

The format is based on [Keep a Changelog 1.1](http://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning 2.0](http://semver.org/spec/v2.0.0.html).

## [0.10.1] - 2025-09-03

### Added

- If the build fails, the notification will allow you to copy log to clipboard

### Fixed

- Issue with default build file being marked as "build.xml;"

## [0.10.0] - 2025-07-30

### Added

- Marks issues in the build.xml if there are any
- Shows notification if there is an issue with the build.xml

### Fixed

- Code used to show notification
- If there was an error in the build.xml processing abruptly stop

## [0.9.1] - 2025-07-01

### Changed

- Updated Ant to 1.10.15.

## [0.9.0] - 2025-07-01

### Added

- NS3X2J now stores the index of the start of elements. Useful for selecting in Nova!

### Fixed

- When editor's view is wrapped, "Show in XML" did not go to the correct position.

## [0.8.0] - 2025-02-25

### Added

- Started adding completions for Ant tags and attributes
- Screenshot to README.md

### Fixed

- NS3X2J was skipping whitespace inside a tag's content

### Changed

- Only shows warning about missing build file when opening a project if it's not the default

## [0.7.0] - 2024-09-27

### Added

- Notices about Apache Ant

## [0.6.0] - 2024-07-04

### Added

- Created new icons

### Changed

- NS3X2J optionally stores position of node
- Clean up and change other scripts around

## [0.5.0] - 2024-07-01

### Added

- Configuration options

## [0.4.0] - 2024-06-23

### Changed

- NS3X2J to handle parsing unmodified XML string.
- NS3X2J stores position of elements.

### Fixed

- Context menus to only enable relevant options.

## [0.3.0] - 2024-06-22

### Changed

- Show nested commands in tree.

## [0.2.0] - 2024-06-19

### Changed

- Replaced XML parsing with custom XML parser

## [0.1.0] - 2024-03-17

### Added

- Started running targets!
- Initial commit
