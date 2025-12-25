# Monorepo Project

## Project Overview

This is a monorepo project that includes both frontend and backend applications, along with shared packages for types and utilities.

### Technologies Used

- **Frontend**: Vue 3, TypeScript, Vite, Pinia, Vue Router
- **Backend**: Node.js, TypeScript, Express
- **Shared**: TypeScript types, utility functions
- **Package Manager**: pnpm

## Directory Structure

```
├── apps/
│   ├── server/           # Backend Express server
│   └── web/              # Frontend Vue application
├── packages/
│   ├── types/            # Shared TypeScript types
│   └── utils/            # Shared utility functions
├── .eslintrc.cjs         # ESLint configuration
├── .gitignore            # Git ignore rules
├── .prettierrc           # Prettier configuration
├── .prettierignore       # Prettier ignore rules
├── package.json          # Root package.json
├── pnpm-lock.yaml        # pnpm lockfile
├── pnpm-workspace.yaml   # pnpm workspace configuration
├── tsconfig.json         # Root TypeScript configuration
└── tsconfig.base.json    # Base TypeScript configuration
```

## Getting Started

### Prerequisites

- Node.js 16+
- pnpm 7+ (package manager)

### Installation

1. Install dependencies:

```bash
pnpm install
```

## Available Scripts

### Development

```bash
# Start all applications in development mode
pnpm dev

# Start only the frontend
pnpm dev:web

# Start only the backend
pnpm dev:server

# Start only the shared packages in watch mode
pnpm dev:packages
```

### Build

```bash
# Build all applications
pnpm build

# Build only the frontend
pnpm build:web

# Build only the backend
pnpm build:server

# Build only the shared packages
pnpm build:packages
```

### Format and Lint

```bash
# Format all files with Prettier
pnpm format

# Check formatting with Prettier
pnpm format:check

# Lint all files with ESLint
pnpm lint

# Fix linting errors with ESLint
pnpm lint:fix
```

### Clean

```bash
# Clean all build outputs
pnpm clean
```

## Development

### Frontend

The frontend application is a Vue 3 SPA located in `apps/web/`.

### Backend

The backend application is an Express server located in `apps/server/`.

### Shared Packages

#### Types

Shared TypeScript types are located in `packages/types/` and can be imported using `@monorepo/types`.

#### Utils

Shared utility functions are located in `packages/utils/` and can be imported using `@monorepo/utils`.

## Build

To build all applications:

```bash
pnpm build
```

This will build the shared packages first, then the frontend and backend applications.

## Testing

```bash
pnpm test
```

## Linting and Formatting

To run both linting and formatting:

```bash
pnpm lint && pnpm format
```
