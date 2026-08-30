// CLI config: where the store lives by default.
export const STORE_DIR_NAME = 'agents'; // under $XDG_CONFIG_HOME (default ~/.config)
export const STORE_CONFIG_FILE = 'config.json'; // remembers a custom store path
// Project stores live in the project. Hidden and distinct from .agents, which
// is where Codex expects project skills to be linked.
export const PROJECT_STORE_DIR_NAME = '.agents-store';
