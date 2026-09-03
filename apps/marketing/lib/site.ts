export const SITE_NAME = "Layera";
export const GITHUB_URL = "https://github.com/AloneDay-91/Layera";
export const LANDING_MAX_WIDTH = "max-w-7xl";

export const INSTALL_COMMANDS = [
  `git clone ${GITHUB_URL}.git`,
  "cd Layera",
  "cp .env.example .env",
  "docker compose up --build",
].join("\n");

