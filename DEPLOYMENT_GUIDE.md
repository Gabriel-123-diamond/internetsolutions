# Internet Solutions: Complete Production Deployment Guide

This document is the definitive end-to-end production blueprint for deploying the Captive Portal and Voucher Management platform. It links the Google Cloud Platform (GCP) ecosystem with the Node runtime, Nginx reverse proxy, security vaults, and the self-healing reverse SSH tunnel architecture on OpenWrt hardware.

---

## Google Cloud Platform (GCP) Provisioning
Execute these initialization commands inside your Google Cloud Web Shell to allocate your external resources and open the required network ports.

### Provision the Compute Engine Virtual Machine
This script declares a high-performance, cost-effective virtualization instance running Debian 11 with built-in pre-flight checks.
```bash
if ! gcloud compute instances describe captive-portal-vm --zone=$(gcloud config get-value compute/zone) > /dev/null 2>&1; then
    gcloud compute instances create captive-portal-vm \
        --machine-type=e2-micro \
        --tags=http-server,https-server \
        --image-family=debian-11 \
        --image-project=debian-cloud \
        --boot-disk-size=10GB
else
    echo "Instance 'captive-portal-vm' already exists."
fi
```

### Configure the External Ingress Firewall Rule
Open an absolute dedicated ingress lane on port 2222 to accommodate the continuous reverse tunneling payloads dispatched by the router.
```bash
if ! gcloud compute firewall-rules describe allow-ssh-tunnel > /dev/null 2>&1; then
    gcloud compute firewall-rules create allow-ssh-tunnel \
        --allow=tcp:2222 \
        --description="Allow Reverse SSH Tunnel Ingress" \
        --direction=INGRESS \
        --priority=1000 \
        --network=default \
        --action=ALLOW \
        --rules=tcp:2222 \
        --source-ranges=0.0.0.0/0
else
    echo "Firewall rule 'allow-ssh-tunnel' already exists."
fi
```

---

## Cloud Server Optimization & Application Setup
Establish a terminal connection to your virtual machine via SSH from the GCP Compute Engine console. Execute these commands to build the system dependencies.

### Initialize Virtual Memory Swapfile
To prevent Out-Of-Memory (OOM) faults during concurrent processing peaks, configure a 2GB system swap space.
```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile && echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

### Deploy the Bun Runtime & System Daemons
Deploy the native Bun engine, update package indices, and install Nginx, Certbot SSL, and Git.
```bash
curl -fsSL [https://bun.sh/install](https://bun.sh/install) | bash && source ~/.bashrc
sudo apt update && sudo apt install nginx certbot python3-certbot-nginx git -y
```

### Clone and Install Application Dependencies
Download the complete code repository into the home directory and install the required modules.
```bash
git clone [https://github.com/Gabriel-123-diamond/internetsolutions.git](https://github.com/Gabriel-123-diamond/internetsolutions.git) && cd internetsolutions && bun install
```

---

## Environment Secrets Configuration (.env)
Run this command in your app root directory to seed production configurations.
```bash
nano .env
```

Paste the block below inside the editor and adjust your credentials to match your live parameters exactly. Save and exit (Ctrl+O, Enter, Ctrl+X).
```text
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE_NAME
SESSION_SECRET=your_random_long_session_secret_string
PAYSTACK_SECRET_KEY=YOUR_LIVE_SECRET_KEY
PAYSTACK_PUBLIC_KEY=YOUR_LIVE_PUBLIC_KEY
ADMIN_PASSWORD=your_secure_master_admin_password

# Reverse SSH routing mappings back to the physical hardware gateway loop
ROUTER_SSH_HOST=127.0.0.1
ROUTER_SSH_PORT=2222
ROUTER_SSH_USER=root
ROUTER_SSH_PASSWORD=your_physical_router_root_password
```

---

## Nginx Reverse Proxy & SSL Configuration
Generate an isolated routing block deployment setup inside Nginx's configurations on the GCP VM.
```bash
sudo nano /etc/nginx/sites-available/internetsolutions
```

Paste the following context block, modifying yourdomain.com to point to your live domain mapping. Save and exit.
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Link the site layout, reload the server, and request Let's Encrypt SSL validation.
```bash
sudo ln -s /etc/nginx/sites-available/internetsolutions /etc/nginx/sites-enabled/ && sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d yourdomain.com
```

---

## Production Process Management (PM2)
Configure an indestructible daemon for your background Node environment to ensure it restarts automatically.
```bash
bun install -g pm2 && pm2 start src/app.js --name "captive-portal" && pm2 save && pm2 startup
```

---

## SSH Hardening & OS Login Bypass Vault
Ensure your reverse tunnel connection survives background metadata sweeps and dynamic key rotations on GCP.

### Amend Global OpenSSH Forwarding
```bash
echo "GatewayPorts yes" | sudo tee -a /etc/ssh/sshd_config
echo "AllowTcpForwarding yes" | sudo tee -a /etc/ssh/sshd_config
echo "AuthorizedKeysFile .ssh/authorized_keys /etc/ssh/authorized_keys_manual" | sudo tee -a /etc/ssh/sshd_config
sudo systemctl restart sshd
```

### Open the Protected System Key Vault
```bash
sudo nano /etc/ssh/authorized_keys_manual
```
Extract the public key format fingerprint from your physical router's console (via `dropbearkey -y -f /root/.ssh/id_dropbear | grep -E "^ssh-"`). Paste that complete key string onto a single line inside this file, then save and exit.

### Restrict System Access Control Lists
```bash
sudo chmod 644 /etc/ssh/authorized_keys_manual
sudo chown root:root /etc/ssh/authorized_keys_manual
chmod 700 ~/.ssh
```

---

## Interactive Shell Keepalive Optimization
Create an explicit client mapping rule profile on your GCP VM terminal to stop the mobile provider's NAT firewall from automatically dropping idle shell connections.
```bash
nano ~/.ssh/config
```

Paste the following configuration parameters inside the file. Save and exit.
```text
Host localhost
    Port 2222
    User root
    ServerAliveInterval 15
    ServerAliveCountMax 3
```

---

## OpenWrt Router Automation Architecture
Establish a terminal connection to your physical OpenWrt Router via a local network connection (`ssh root@192.168.1.1`) to deploy the self-healing scripts.

### Install Supervisor Binaries
```bash
opkg update && opkg install autossh
```

### Generate the Connection Watchdog Script
```bash
cat << 'EOF' > /usr/bin/run-tunnel.sh
#!/bin/sh

# Loop infinitely until a clear internet gateway connection is fully verified
while ! ping -c 1 8.8.8.8 >/dev/null 2>&1; do 
    sleep 5
done

# Terminate any dead, zombie, or fractured socket pipes hanging in memory
killall autossh ssh 2>/dev/null
sleep 2

# Execute the tunnel with aggressive internal keepalives to prevent carrier timeouts
/usr/sbin/autossh -M 0 -f -N \
    -o "StrictHostKeyChecking=no" \
    -o "KeepAlive=60" \
    -o "ServerAliveInterval=15" \
    -o "ServerAliveCountMax=3" \
    -i /root/.ssh/id_dropbear \
    -R 2222:127.0.0.1:22 gabrielpeterekerete231@34.78.93.106
EOF

chmod +x /usr/bin/run-tunnel.sh
```

### Wire Up Fail-Safe Automation Triggers
```bash
# Network Interface Up-State Hotplug Hook
cat << 'EOF' > /etc/hotplug.d/iface/99-cloud-tunnel
#!/bin/sh
if [ "$ACTION" = "ifup" ]; then
    /usr/bin/run-tunnel.sh &
fi
EOF
chmod +x /etc/hotplug.d/iface/99-cloud-tunnel

# Initialization System Boot Hook Sequence
sed -i '/exit 0/i \/usr/bin/run-tunnel.sh &' /etc/rc.local

# 60-Second Background Persistent System Watchdog Rule
echo "* * * * * /usr/bin/run-tunnel.sh" >> /etc/crontabs/root
/etc/init.d/cron enable && /etc/init.d/cron restart
```

### Clean Legacy Artifacts and Launch
```bash
rm -f /etc/init.d/cloud-tunnel
/usr/bin/run-tunnel.sh
```

---

## Post-Deployment Verification & Routing Fix

### Admin Settings Dashboard POST Router Patch
Open your cloud project workspace repository file on your GCP VM and patch this code-level route error to prevent password modification form actions from throwing 404 faults.
```bash
nano src/routes/admin.js
```

Ensure your protected administration routes mapping block contains the missing POST line right below settings. Save and exit.
```javascript
router.get('/settings', (req, res) => adminController.renderSettings(req, res));
// INJECT THIS REQUIRED POST ROUTE HANDLER LINK:
router.post('/change-password', (req, res) => authController.changePassword(req, res));
```

### Final Runtime Validation
Check your proxy socket list from your GCP VM terminal to confirm initialization:
```bash
sudo ss -tlnp | grep 2222
```

Cross the permanent secure cloud gateway lane to gain instant command shell control over your headless remote hardware:
```bash
ssh root@localhost
```