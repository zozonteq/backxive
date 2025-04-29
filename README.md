# BackXive

A tool for retrieving deleted X(Twitter) tweets and their media content from Wayback Machine archives. This tool helps you recover tweets that have been deleted but were previously archived by the Wayback Machine.

## Features

- Retrieve deleted tweets from Wayback Machine archives
- Download media content (images) from archived tweets
- Multi-threaded downloads for improved performance
- Robust error handling with automatic retries
- Date-based hierarchical data organization
- Optimized execution using Bun runtime

## Requirements

- [Bun](https://bun.sh/) (v1.0.0 or later)

## Installation

```bash
# Clone the repository
git clone https://github.com/zozonteq/backxive.git
cd backxive

# Install dependencies
bun install
```

## Configuration

Create a `.env` file in the root directory with the following settings:

```env
WAYBACK_BASE_URL=https://web.archive.org/web
TWEETS_DIR=./tweets
```

## Usage

### List Archived Tweets

Generate a list of archived tweets to download:

```bash
bun run src/cli.ts list <username>
```

### Download Archived Tweets

Download deleted tweets from the Wayback Machine:

```bash
bun run src/cli.ts download <list_file>
```

### Download Archived Images

Download images from archived tweets:

```bash
bun run src/cli.ts image <username>
```

## Directory Structure

```
.
├── attaches/          # Downloaded images from archived tweets
├── tweets/           # Downloaded archived tweets
│   └── YYYY/        # Year
│       └── MM/      # Month
│           └── DD/  # Day
├── src/
│   ├── cli.ts       # Command-line interface
│   ├── modules/     # Feature modules
│   └── core/        # Core functionality
└── .env             # Configuration file
```

## Error Handling

The tool includes robust error handling with the following features:

- Automatic retries for failed downloads
- Rate limiting protection for Wayback Machine API
- Skip existing files
- Detailed error reporting
- Handling of 404 errors for deleted content

## Note

- This tool can only retrieve tweets that were previously archived by the Wayback Machine
- Not all deleted tweets may be available in the archive
- The success rate depends on the Wayback Machine's archive coverage

## License

MIT License