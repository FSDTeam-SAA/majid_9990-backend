import request from 'supertest';
import app from '../../src/app';

describe('API Integration Tests', () => {
  it('GET /health should return 200', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);
    
    expect(response.body).toHaveProperty('status', 'ok');
  });
});
