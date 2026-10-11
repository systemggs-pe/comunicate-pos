import type { Express } from 'express';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { reportTypes } from '../../shared/reports.js';
import { authState, requestContext, requirePermission } from '../auth/middleware.js';
import { createReportsService } from '../services/reports.service.js';

export function registerReportRoutes(app: Express, db: PrismaClient) {
  app.get('/api/reports/actors', requirePermission('reports.read'), async (req, res) => {
    const input = z.object({ q: z.string().trim().max(100).default(''), page: z.coerce.number().int().min(1).max(100000).default(1) }).strict().parse(req.query);
    const where = { name: { contains: input.q, mode: 'insensitive' as const } };
    const [rows, total] = await db.$transaction([db.user.findMany({ where, select: { id: true, name: true, status: true }, orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 100, skip: (input.page - 1) * 100 }), db.user.count({ where })]);
    res.json({ rows, total, page: input.page });
  });
  app.get('/api/dashboard/summary', requirePermission('reports.read'), async (req, res) => res.json(await createReportsService(db).read('general', req.query)));
  for (const type of reportTypes) app.get(`/api/reports/${type}`, requirePermission('reports.read'), async (req, res) => res.json(await createReportsService(db).read(type, req.query)));
  app.get('/api/reports/export', requirePermission('reports.read', 'reports.export'), async (req, res) => {
    const { type, ...query } = req.query;
    const selected = z.enum(reportTypes).parse(type);
    const result = await createReportsService(db, requestContext(req, authState(res).user.id)).export(selected, query);
    res.set('Content-Type', 'text/csv; charset=utf-8').attachment(result.filename).send(result.csv);
  });
}
