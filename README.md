# Unfold - AI-Powered Codebase Explorer

A sleek, elegant interface for exploring and understanding your codebase with AI-powered insights.

## Features

- **GitHub OAuth Integration**: Secure authentication with PKCE flow for accessing private repositories
- **Repository Browser**: Clean interface to browse and select from your GitHub repositories
- **AI-Powered Analysis**: Ask questions about your codebase and get intelligent answers
- **Code Search**: Fast semantic search across your entire codebase
- **Visual Context**: Screenshots and visual aids for better understanding
- **Share Sessions**: Share your exploration sessions with team members
- **Slack Integration**: Demo integration for team collaboration

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd code-whisperer-unfold
npm install
```

### 2. GitHub OAuth Setup

To enable GitHub OAuth authentication:

1. **Create a GitHub OAuth App**:
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - Click "New OAuth App"
   - Set Application name: `Unfold`
   - Set Homepage URL: `http://localhost:5173` (for development)
   - Set Authorization callback URL: `http://localhost:5173`
   - Click "Register application"

2. **Update Client ID**:
   - Copy your Client ID from the OAuth app
   - Open `src/services/githubOAuth.ts`
   - Replace `YOUR_CLIENT_ID_HERE` with your actual Client ID

3. **For Production**:
   - Update the Homepage URL and Authorization callback URL to your production domain
   - Update the `GITHUB_REDIRECT_URI` in the OAuth service

### 3. Run the Application

```bash
npm run dev
```

Visit `http://localhost:5173` and follow the onboarding flow to connect your GitHub account.

## Usage

### First Time Setup

1. **Welcome**: Learn about Unfold's capabilities
2. **Connect GitHub**: Use OAuth to securely connect your GitHub account
3. **Select Repository**: Browse and select from your repositories
4. **Repository Connected**: Your repository is scanned and ready
5. **OpenAI API Key** (Optional): Add your OpenAI API key for enhanced AI features

### Manual Repository Setup (Fallback)

If you prefer not to use OAuth, you can manually connect a repository:

1. Get a GitHub Personal Access Token (fine-grained recommended)
2. Grant `Contents (Read)` and `Metadata (Read)` permissions
3. Enter repository owner, name, and token in the manual setup

### Asking Questions

Once connected, you can ask questions like:
- "How does authentication work in this codebase?"
- "What is the main architecture pattern used?"
- "How can I add a new feature to this project?"
- "Show me the database schema"

## Security & Privacy

- **OAuth Tokens**: Stored locally in your browser's localStorage
- **No Server Storage**: Your tokens and repository data never leave your browser
- **Read-Only Access**: Only requests read permissions for repository contents
- **PKCE Security**: Uses Proof Key for Code Exchange for enhanced security

## Development

### Project Structure

```
src/
├── components/          # React components
│   ├── ui/             # Shadcn/ui components
│   └── ...             # Feature components
├── services/           # Business logic and API calls
│   ├── githubOAuth.ts  # GitHub OAuth implementation
│   ├── githubClient.ts # GitHub API client
│   └── ...             # Other services
├── pages/              # Page components
└── hooks/              # Custom React hooks
```

### Key Technologies

- **React 18** with TypeScript
- **Vite** for fast development
- **Tailwind CSS** for styling
- **Shadcn/ui** for UI components
- **Octokit** for GitHub API integration
- **React Router** for navigation
- **Sonner** for toast notifications

### Available Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run build:dev    # Build for development
npm run lint         # Run ESLint
npm run preview      # Preview production build
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
