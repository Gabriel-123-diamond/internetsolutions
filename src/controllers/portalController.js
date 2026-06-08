const voucherService = require('../services/voucherService');

class PortalController {
  async renderPortal(req, res) {
    const { mac, ip, gw_address, gw_port, uamip, uamport } = req.query;
    
    if (mac) req.session.mac = mac;
    if (ip) req.session.ip = ip;
    
    // Support both custom and standard CoovaChilli parameters
    const final_gw_address = gw_address || uamip;
    const final_gw_port = gw_port || uamport;
    
    if (final_gw_address) req.session.gw_address = final_gw_address;
    if (final_gw_port) req.session.gw_port = final_gw_port;

    try {
      const plans = await voucherService.getAllPlans();
      res.render('portal', { 
        title: 'Welcome to Our Captive Portal',
        error: req.query.error,
        notice: req.query.notice,
        mac: mac || req.session.mac,
        plans
      });
    } catch (err) {
      console.error(err);
      res.render('portal', { 
        title: 'Welcome to Our Captive Portal',
        error: 'Failed to load plans',
        notice: req.query.notice,
        mac: mac || req.session.mac,
        plans: []
      });
    }
  }

  async loginVoucher(req, res) {
    const { voucherCode } = req.body;
    const mac = req.session.mac;

    if (!voucherCode || voucherCode.length !== 6) {
      return res.redirect('/portal?error=Invalid voucher code');
    }

    try {
      const voucher = await voucherService.getVoucherByCode(voucherCode);
      if (!voucher) return res.redirect('/portal?error=Voucher not found');

      const verification = await voucherService.verifyVoucherLimits(voucher);
      if (!verification.valid) return res.redirect(`/portal?error=${verification.error}`);

      await voucherService.activateVoucher(voucher.id, mac);

      const { gw_address, gw_port } = req.session;
      if (gw_address && gw_port) {
        console.log(`Redirecting to CoovaChilli: http://${gw_address}:${gw_port}`);
        const redirectUrl = `http://${gw_address}:${gw_port}/www/login.chi?username=${voucher.username}&password=${voucher.password}`;
        return res.redirect(redirectUrl);
      } else {
        console.log('No gateway info in session, showing success page');
        return res.render('payment_success', { 
          title: 'Success', 
          voucher, 
          notice: 'Voucher activated! If you are not redirected, please try to access any website.' 
        });
      }
    } catch (err) {
      console.error(err);
      res.redirect('/portal?error=Internal server error');
    }
  }

  async renderDashboard(req, res) {
    try {
      const vouchers = await voucherService.getUserVouchers(req.session.userId);
      res.render('dashboard', { 
        title: 'User Dashboard', 
        vouchers, 
        error: req.query.error, 
        notice: req.query.notice 
      });
    } catch (err) {
      console.error(err);
      res.render('error', { title: 'Error', error: 'Failed to load dashboard' });
    }
  }

  renderSettings(req, res) {
    res.render('settings', { title: 'Account Settings', error: req.query.error, notice: req.query.notice });
  }
}

module.exports = new PortalController();
