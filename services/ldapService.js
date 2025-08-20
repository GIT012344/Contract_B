const ldap = require('ldapjs');
const { authenticate } = require('ldap-authentication');

class LDAPService {
  constructor() {
    // กำหนดค่า LDAP Server (ปรับตามองค์กรของคุณ)
    this.config = {
      ldapOpts: {
        url: process.env.LDAP_URL || 'ldap://your-domain-controller:389',
        // สำหรับ Active Directory
        // url: 'ldap://ad.company.com:389'
      },
      // Base DN สำหรับค้นหา user
      userDn: process.env.LDAP_USER_DN || 'ou=users,dc=company,dc=com',
      // สำหรับ Active Directory
      // userDn: 'cn=users,dc=company,dc=com'
      
      // User search filter
      userSearchBase: process.env.LDAP_SEARCH_BASE || 'ou=users,dc=company,dc=com',
      usernameAttribute: process.env.LDAP_USERNAME_ATTR || 'uid',
      // สำหรับ Active Directory ใช้ 'sAMAccountName'
      
      // Admin credentials สำหรับ bind (ถ้าจำเป็น)
      adminDn: process.env.LDAP_ADMIN_DN || 'cn=admin,dc=company,dc=com',
      adminPassword: process.env.LDAP_ADMIN_PASSWORD || 'admin_password'
    };
  }

  /**
   * Authenticate user กับ LDAP Server
   * @param {string} username - ชื่อผู้ใช้
   * @param {string} password - รหัสผ่าน
   * @returns {Object} ข้อมูลผู้ใช้หรือ null ถ้า authentication ล้มเหลว
   */
  async authenticateUser(username, password) {
    // ตรวจสอบการตั้งค่า LDAP ก่อน
    if (!process.env.LDAP_URL || process.env.LDAP_URL.includes('your-domain-controller')) {
      console.log('LDAP not configured, skipping LDAP authentication');
      return { success: false, error: 'LDAP not configured' };
    }

    try {
      console.log(`Attempting LDAP authentication for user: ${username}`);
      
      // เพิ่ม timeout สำหรับ LDAP operations
      const options = {
        ldapOpts: {
          ...this.config.ldapOpts,
          timeout: 10000, // 10 second timeout
          connectTimeout: 10000
        },
        adminDn: this.config.adminDn,
        adminPassword: this.config.adminPassword,
        userSearchBase: this.config.userSearchBase,
        usernameAttribute: this.config.usernameAttribute,
        username: username,
        userPassword: password,
        // ข้อมูลที่ต้องการดึงมา
        attributes: ['cn', 'mail', 'displayName', 'department', 'title', 'memberOf']
      };

      // ใช้ Promise.race เพื่อ timeout
      const authPromise = authenticate(options);
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('LDAP authentication timeout')), 15000);
      });

      const user = await Promise.race([authPromise, timeoutPromise]);
      
      if (user) {
        console.log('LDAP authentication successful for:', username);
        
        // แปลงข้อมูล LDAP เป็นรูปแบบที่ใช้ในระบบ
        const userData = {
          dn: user.dn || `${this.config.usernameAttribute}=${username},${this.config.userSearchBase}`,
          username: username,
          displayName: user.displayName || user.cn || username,
          email: user.mail || `${username}@company.com`,
          department: user.department || 'Unknown',
          title: user.title || 'User',
          groups: user.memberOf || [],
          // กำหนด role จาก LDAP groups (ปรับตามองค์กร)
          role: this.determineUserRole(user.memberOf || []),
          ldapData: user // เก็บข้อมูล LDAP เต็ม
        };
        
        return { success: true, user: userData };
      }
      
      return { success: false, error: 'Invalid credentials' };
    } catch (error) {
      console.error('LDAP authentication error:', error.message);
      
      // ถ้า LDAP Server ไม่พร้อมใช้งาน ให้ fallback เป็น local auth
      if (error.code === 'ECONNREFUSED' || 
          error.code === 'ENOTFOUND' || 
          error.message.includes('timeout') ||
          error.message.includes('getaddrinfo')) {
        console.warn('LDAP server unavailable, will fallback to local authentication');
        return { success: false, error: 'LDAP server unavailable' };
      }
      
      return { success: false, error: error.message };
    }
  }

  /**
   * กำหนด role ของผู้ใช้จาก LDAP groups
   * @param {Array} memberOf - รายการ groups ที่ user เป็นสมาชิก
   * @returns {string} role ของผู้ใช้
   */
  determineUserRole(memberOf) {
    if (!Array.isArray(memberOf)) {
      return 'user';
    }
    
    // ตรวจสอบ admin groups (ปรับตามองค์กร)
    const adminGroups = [
      'cn=administrators,ou=groups,dc=company,dc=com',
      'cn=contract-admins,ou=groups,dc=company,dc=com',
      'CN=Domain Admins,CN=Users,DC=company,DC=com' // Active Directory
    ];
    
    const isAdmin = memberOf.some(group => 
      adminGroups.some(adminGroup => 
        group.toLowerCase().includes(adminGroup.toLowerCase())
      )
    );
    
    return isAdmin ? 'admin' : 'user';
  }

  /**
   * ทดสอบการเชื่อมต่อ LDAP Server
   * @returns {boolean} สถานะการเชื่อมต่อ
   */
  async testConnection() {
    // ถ้าไม่ได้ตั้งค่า LDAP URL หรือเป็น default value ให้ return false
    if (!process.env.LDAP_URL || process.env.LDAP_URL.includes('your-domain-controller')) {
      console.log('LDAP not configured, skipping LDAP authentication');
      return false;
    }

    try {
      const client = ldap.createClient({
        ...this.config.ldapOpts,
        timeout: 5000, // 5 second timeout
        connectTimeout: 5000
      });
      
      return new Promise((resolve) => {
        // Set timeout for the entire operation
        const timeoutId = setTimeout(() => {
          try {
            client.unbind();
          } catch (e) {
            // Ignore unbind errors
          }
          console.log('LDAP connection test timed out');
          resolve(false);
        }, 5000);

        client.on('error', (err) => {
          clearTimeout(timeoutId);
          console.error('LDAP connection test failed:', err.message);
          resolve(false);
        });

        client.bind(this.config.adminDn, this.config.adminPassword, (err) => {
          clearTimeout(timeoutId);
          try {
            client.unbind();
          } catch (e) {
            // Ignore unbind errors
          }
          
          if (err) {
            console.error('LDAP connection test failed:', err.message);
            resolve(false);
          } else {
            console.log('LDAP connection test successful');
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('LDAP connection test error:', error.message);
      return false;
    }
  }

  /**
   * ค้นหาข้อมูลผู้ใช้จาก LDAP (ไม่ต้อง authenticate)
   * @param {string} username - ชื่อผู้ใช้
   * @returns {Object} ข้อมูลผู้ใช้
   */
  async searchUser(username) {
    try {
      const client = ldap.createClient(this.config.ldapOpts);
      
      return new Promise((resolve, reject) => {
        client.bind(this.config.adminDn, this.config.adminPassword, (err) => {
          if (err) {
            client.unbind();
            return reject(err);
          }
          
          const searchOptions = {
            filter: `(${this.config.usernameAttribute}=${username})`,
            scope: 'sub',
            attributes: ['cn', 'mail', 'displayName', 'department', 'title', 'memberOf']
          };
          
          client.search(this.config.userSearchBase, searchOptions, (err, res) => {
            if (err) {
              client.unbind();
              return reject(err);
            }
            
            let userFound = null;
            
            res.on('searchEntry', (entry) => {
              userFound = entry.object;
            });
            
            res.on('end', () => {
              client.unbind();
              resolve(userFound);
            });
            
            res.on('error', (err) => {
              client.unbind();
              reject(err);
            });
          });
        });
      });
    } catch (error) {
      console.error('LDAP user search error:', error.message);
      throw error;
    }
  }
}

module.exports = new LDAPService();
