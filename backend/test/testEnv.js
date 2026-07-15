process.env.DATABASE_URL = '';
process.env.DB_REQUIRE_POSTGRES = '';
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'TestOnlyJwtSecret9-With-Sufficient-Length';
process.env.DEFAULT_ADMIN_EMAIL ||= 'bootstrap-admin@example.test';
process.env.DEFAULT_ADMIN_PASSWORD ||= 'TestOnly!BootstrapAdmin9';
process.env.BASIC_AUTH_USER ||= 'test-basic-user';
process.env.BASIC_AUTH_PASS ||= 'TestOnly!BasicCredential8';

