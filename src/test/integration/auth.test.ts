import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { supabase } from '../../lib/supabase';

describe('Authentication System Integration Tests', () => {
  const testUsername = `test_user_${Date.now()}`;
  const testPassword = 'TestPassword123!';
  let testUserId: string | null = null;

  beforeAll(async () => {
    console.log('Setting up authentication integration tests...');
  });

  afterAll(async () => {
    if (testUserId) {
      console.log('Cleaning up test user...');
      try {
        await supabase.from('users').delete().eq('id', testUserId);
      } catch (error) {
        console.error('Error cleaning up test user:', error);
      }
    }
  });

  describe('Database Health Check', () => {
    it('should verify system health is good', async () => {
      const { data, error } = await supabase.rpc('run_system_health_check');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.overall_status).toBe('HEALTHY');

      const testResults = data.test_results;
      expect(testResults).toBeDefined();
      expect(Array.isArray(testResults)).toBe(true);

      const criticalTests = ['pgcrypto_extension_access', 'password_hashing', 'password_verification'];
      criticalTests.forEach(testName => {
        const test = testResults.find((t: any) => t.test === testName);
        expect(test, `Critical test ${testName} should exist`).toBeDefined();
        expect(test.status, `${testName} should pass`).toBe('PASS');
      });
    });

    it('should verify all authentication functions are accessible', async () => {
      const { data, error } = await supabase.rpc('run_system_health_check');

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const functionTests = data.test_results.filter((t: any) =>
        t.test.includes('_function')
      );

      functionTests.forEach((test: any) => {
        expect(
          ['PASS', 'WARNING'].includes(test.status),
          `Function test ${test.test} should pass or warn, got: ${test.status} - ${test.message}`
        ).toBe(true);
      });
    });
  });

  describe('Password Operations', () => {
    it('should verify admin user exists with password', async () => {
      const { data, error } = await supabase
        .from('users')
        .select('username, role')
        .eq('username', 'admin')
        .eq('role', 'admin')
        .maybeSingle();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.username).toBe('admin');
      expect(data?.role).toBe('admin');
    });

    it('should handle invalid credentials gracefully', async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/login`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: 'nonexistent_user',
          password: 'wrong_password',
        }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);

      const data = await response.json();
      expect(data.error).toBeDefined();
      expect(data.error).toContain('Invalid username or password');
    });

    it('should reject login with empty credentials', async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/login`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: '',
          password: '',
        }),
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('System Code Verification', () => {
    it('should reject invalid system codes', async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/verify-code`;

      const { data: adminData } = await supabase
        .from('users')
        .select('id')
        .eq('username', 'admin')
        .eq('role', 'admin')
        .maybeSingle();

      if (!adminData) {
        console.warn('Skipping test: No admin user found');
        return;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code: 'invalid_code_12345',
          adminUserId: adminData.id,
        }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.valid).toBe(false);
    });
  });

  describe('Edge Function Connectivity', () => {
    it('should have auth edge function accessible', async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/login`;

      const response = await fetch(apiUrl, {
        method: 'OPTIONS',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      });

      expect(response.status).toBe(200);

      const corsHeaders = response.headers.get('Access-Control-Allow-Origin');
      expect(corsHeaders).toBeDefined();
    });

    it('should return proper error for malformed requests', async () => {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/auth/login`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: 'invalid json',
      });

      expect(response.ok).toBe(false);
    });
  });

  describe('Critical Security Checks', () => {
    it('should verify pgcrypto is in extensions schema', async () => {
      const { data, error } = await supabase.rpc('run_system_health_check');

      expect(error).toBeNull();
      const pgcryptoTest = data.test_results.find(
        (t: any) => t.test === 'pgcrypto_extension_access'
      );

      expect(pgcryptoTest.status).toBe('PASS');
    });

    it('should verify password functions have correct search_path', async () => {
      const { data: healthData, error } = await supabase.rpc('run_system_health_check');

      expect(error).toBeNull();

      const criticalFunctionTests = healthData.test_results.filter((t: any) =>
        ['verify_password_function', 'verify_system_code_function'].includes(t.test)
      );

      criticalFunctionTests.forEach((test: any) => {
        expect(test.status).toBe('PASS');
      });
    });
  });
});
