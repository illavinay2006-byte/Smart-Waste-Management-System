import sys
import os
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import unittest
import json
from backend.app import create_app
from backend.database.db import db
from backend.models.user import User

class TestSingleActiveSession(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client_a = self.app.test_client()
        self.client_b = self.app.test_client()

    def test_single_active_session_enforcement(self):
        # 1. Device A logs in as citizen
        res_a = self.client_a.post('/api/auth/login', json={
            'email': 'citizen@demo.com',
            'password': 'demo123'
        })
        self.assertEqual(res_a.status_code, 200)

        # Device A can access protected route
        me_a1 = self.client_a.get('/api/auth/me')
        self.assertEqual(me_a1.status_code, 200)
        self.assertTrue(json.loads(me_a1.data)['authenticated'])

        # 2. Device B logs in with the same credentials
        res_b = self.client_b.post('/api/auth/login', json={
            'email': 'citizen@demo.com',
            'password': 'demo123'
        })
        self.assertEqual(res_b.status_code, 200)

        # Device B is now the active session
        me_b = self.client_b.get('/api/auth/me')
        self.assertEqual(me_b.status_code, 200)
        self.assertTrue(json.loads(me_b.data)['authenticated'])

        # 3. Device A tries to access protected endpoints -> invalidated!
        me_a2 = self.client_a.get('/api/auth/me')
        self.assertFalse(json.loads(me_a2.data)['authenticated'])

        notif_a = self.client_a.get('/api/notifications')
        self.assertEqual(notif_a.status_code, 401)

    def test_logout_terminates_session(self):
        res = self.client_a.post('/api/auth/login', json={
            'email': 'citizen@demo.com',
            'password': 'demo123'
        })
        self.assertEqual(res.status_code, 200)

        # Logout
        out_res = self.client_a.post('/api/auth/logout')
        self.assertEqual(out_res.status_code, 200)

        # Access after logout is unauthorized
        me = self.client_a.get('/api/auth/me')
        self.assertFalse(json.loads(me.data)['authenticated'])

if __name__ == '__main__':
    unittest.main()
