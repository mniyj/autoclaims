module.exports = {
  apps: [
    {
      name: "smartclaim-ai-agent-3006",
      script: "./server.js",
      cwd: "/var/www/smartclaim-ai-agent",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: 3006,
        API_TARGET: "http://127.0.0.1:3005",
        VOICE_API_TARGET: "http://127.0.0.1:3005",
      },
    },
  ],
};
