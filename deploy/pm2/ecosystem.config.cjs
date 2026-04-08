// PM2 process file for DisputeIQ on a Hostinger VPS.
// Usage:
//   pm2 start deploy/pm2/ecosystem.config.cjs --env production
//   pm2 save
//   pm2 startup
module.exports = {
  apps: [
    {
      name: "disputeiq",
      cwd: "/var/www/disputeiq",
      script: "node_modules/next/dist/bin/next",
      args: "start -p 3000",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "768M",
      env_production: {
        NODE_ENV: "production",
        PORT: "3000",
      },
    },
  ],
};
