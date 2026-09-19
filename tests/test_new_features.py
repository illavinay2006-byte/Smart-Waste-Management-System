import unittest
import json
from backend.app import create_app
from backend.database.db import db
from backend.models.user import User
from backend.models.report import WasteReport

class TestNewFeatures(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.app.config['TESTING'] = True
        self.client = self.app.test_client()
        self.ctx = self.app.app_context()
        self.ctx.push()

    def tearDown(self):
        self.ctx.pop()

    def test_citizen_stats_and_leaderboard(self):
        # Switch demo to citizen
        res = self.client.post('/api/auth/switch-demo', json={'role': 'citizen'})
        self.assertEqual(res.status_code, 200)

        # Get stats
        res = self.client.get('/api/citizen/stats')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('stats', data)
        self.assertIn('total_reports', data['stats'])
        self.assertIn('points', data['stats'])
        self.assertIn('rank_tier', data['stats'])

        # Get leaderboard
        res = self.client.get('/api/citizen/leaderboard')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('leaderboard', data)
        self.assertGreater(len(data['leaderboard']), 0)

    def test_announcements(self):
        # Get active announcements
        res = self.client.get('/api/announcements')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('announcements', data)

        # Switch to officer
        self.client.post('/api/auth/switch-demo', json={'role': 'officer'})
        res = self.client.post('/api/announcements', json={
            'title': 'Test Drive Notice',
            'message': 'Community clean up drive this weekend.',
            'category': 'Event',
            'priority': 'HIGH',
            'target_ward': 'Ward 5 - Central'
        })
        self.assertEqual(res.status_code, 201)
        created_id = res.get_json()['announcement']['id']

        # Delete announcement
        res = self.client.delete(f'/api/announcements/{created_id}')
        self.assertEqual(res.status_code, 200)

    def test_analytics_heatmap_and_workload(self):
        self.client.post('/api/auth/switch-demo', json={'role': 'officer'})
        # Heatmap
        res = self.client.get('/api/analytics/heatmap')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('heatmap_points', data)
        self.assertIn('ward_stats', data)

        # Worker Workload
        res = self.client.get('/api/analytics/workers-workload')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('workers', data)
        self.assertGreater(len(data['workers']), 0)

    def test_reports_filter_and_pdf(self):
        self.client.post('/api/auth/switch-demo', json={'role': 'officer'})
        res = self.client.get('/api/reports?q=Ward&status=SUBMITTED')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertIn('reports', data)

        # First report PDF
        all_reps = self.client.get('/api/reports').get_json()['reports']
        if all_reps:
            r_id = all_reps[0]['id']
            res = self.client.get(f'/api/reports/{r_id}/pdf')
            self.assertEqual(res.status_code, 200)
            self.assertIn(b'SmartWaste CIVIC', res.data)

if __name__ == '__main__':
    unittest.main()
