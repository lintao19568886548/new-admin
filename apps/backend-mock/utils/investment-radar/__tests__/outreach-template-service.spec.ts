import { beforeEach, describe, expect, it, vi } from 'vitest';

import { prismaClient } from '../../db';
import {
  DEFAULT_OUTREACH_TEMPLATES,
  ensureOutreachTemplateTable,
  fillOutreachTemplateContent,
  listEnabledOutreachTemplates,
  listOutreachTemplates,
  pickOutreachTemplate,
  selectOutreachTemplatesForLead,
  setOutreachTemplateEnabled,
} from '../outreach-template-service';

vi.mock('../../db', () => ({
  prismaClient: {
    $executeRawUnsafe: vi.fn(),
    $queryRawUnsafe: vi.fn(),
  },
}));

const mockedPrisma = vi.mocked(prismaClient);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('outreach template service', () => {
  it('fills template placeholders with lead data', () => {
    expect(
      fillOutreachTemplateContent('您好 {companyName}，推荐 {parkName}', {
        companyName: '测试企业',
        parkName: '测试园区',
      }),
    ).toBe('您好 测试企业，推荐 测试园区');
  });

  it('selects A priority templates with A and B templates', () => {
    const templates = [
      { priorityLevel: 'A', templateCode: 'A' },
      { priorityLevel: 'B', templateCode: 'B' },
      { priorityLevel: 'C', templateCode: 'C' },
    ] as any[];

    expect(selectOutreachTemplatesForLead(templates, 'A')).toHaveLength(2);
    expect(selectOutreachTemplatesForLead(templates, 'B')).toEqual([
      templates[1],
    ]);
  });

  it('picks templates by priority or score', () => {
    const templates = [
      { priorityLevel: 'A', templateCode: 'A' },
      { priorityLevel: 'B', templateCode: 'B' },
      { priorityLevel: 'C', templateCode: 'C' },
    ] as any[];

    expect(pickOutreachTemplate(templates, 'C', 85).templateCode).toBe('A');
    expect(pickOutreachTemplate(templates, 'C', 70).templateCode).toBe('B');
    expect(pickOutreachTemplate(templates, 'C', 30).templateCode).toBe('C');
    expect(pickOutreachTemplate([], 'A', 95)).toBeNull();
  });

  it('seeds the default operational templates into storage', async () => {
    mockedPrisma.$queryRawUnsafe = vi.fn().mockResolvedValue([]);

    await ensureOutreachTemplateTable();

    expect(mockedPrisma.$executeRawUnsafe).toHaveBeenCalledTimes(
      2 + DEFAULT_OUTREACH_TEMPLATES.length,
    );
    expect(mockedPrisma.$queryRawUnsafe).toHaveBeenCalledTimes(2);
    for (const template of DEFAULT_OUTREACH_TEMPLATES) {
      expect(mockedPrisma.$executeRawUnsafe).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO investment_outreach_template'),
        template.templateCode,
        template.templateName,
        template.taskType,
        template.channel,
        template.priorityLevel,
        template.content,
        expect.any(String),
      );
    }
  });

  it('lists templates with pagination', async () => {
    mockedPrisma.$queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          channel: 'SMS',
          content: '您好 {companyName}',
          createTime: '2026-05-25T08:00:00.000Z',
          enabled: 1,
          placeholderJson: '["companyName"]',
          priorityLevel: 'A',
          taskType: 'OUTREACH',
          templateCode: 'RADAR_A_SMS',
          templateId: 1,
          templateName: 'A级短信',
          updateTime: '2026-05-25T08:00:00.000Z',
        },
      ]);

    const result = await listOutreachTemplates({
      currentPage: 2,
      enabled: '1',
      keyword: '短信',
      pageSize: 5,
    });

    expect(result.total).toBe(1);
    expect(result.page).toEqual({ currentPage: 2, pageSize: 5, total: 1 });
    expect(result.items[0]).toMatchObject({
      enabled: true,
      placeholderJson: ['companyName'],
      templateCode: 'RADAR_A_SMS',
    });
  });

  it('lists enabled templates from the database table only', async () => {
    mockedPrisma.$queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 1 }])
      .mockResolvedValueOnce([
        {
          channel: 'CALL',
          content: '电话确认 {companyName}',
          enabled: 1,
          placeholderJson: '["companyName"]',
          priorityLevel: 'A',
          taskType: 'OUTREACH',
          templateCode: 'RADAR_A_CALL',
          templateId: 2,
          templateName: 'A级电话',
        },
      ]);

    const result = await listEnabledOutreachTemplates();

    expect(mockedPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM investment_outreach_template'),
      1,
      'APPROVED',
    );
    expect(mockedPrisma.$queryRawUnsafe).toHaveBeenCalledWith(
      expect.stringContaining('FROM investment_outreach_template'),
      1,
      'APPROVED',
      100,
      0,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      enabled: true,
      templateCode: 'RADAR_A_CALL',
    });
  });

  it('enables or disables templates by id', async () => {
    const updateResults = [1, 1, 0, 0];
    mockedPrisma.$executeRawUnsafe = vi.fn(async (sql: unknown) =>
      String(sql).includes('UPDATE investment_outreach_template')
        ? updateResults.shift()
        : 1,
    ) as any;
    mockedPrisma.$queryRawUnsafe = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          approvalStatus: 'APPROVED',
          channel: 'SMS',
          content: '您好 {companyName}',
          enabled: 1,
          placeholderJson: '["companyName"]',
          priorityLevel: 'A',
          taskType: 'OUTREACH',
          templateCode: 'RADAR_A_SMS',
          templateId: 8,
          templateName: 'A级短信',
          versionNo: 1,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          approvalStatus: 'APPROVED',
          channel: 'SMS',
          content: '您好 {companyName}',
          enabled: 1,
          placeholderJson: '["companyName"]',
          priorityLevel: 'A',
          taskType: 'OUTREACH',
          templateCode: 'RADAR_A_SMS',
          templateId: 7,
          templateName: 'A级短信',
          versionNo: 1,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          approvalStatus: 'APPROVED',
          channel: 'SMS',
          content: '您好 {companyName}',
          enabled: 0,
          placeholderJson: '["companyName"]',
          priorityLevel: 'A',
          taskType: 'OUTREACH',
          templateCode: 'RADAR_A_SMS',
          templateId: 8,
          templateName: 'A级短信',
          versionNo: 1,
        },
      ])
      .mockResolvedValueOnce([
        {
          approvalStatus: 'APPROVED',
          channel: 'SMS',
          content: '您好 {companyName}',
          enabled: 1,
          placeholderJson: '["companyName"]',
          priorityLevel: 'A',
          taskType: 'OUTREACH',
          templateCode: 'RADAR_A_SMS',
          templateId: 8,
          templateName: 'A级短信',
          versionNo: 1,
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(setOutreachTemplateEnabled(7, true)).resolves.toEqual({
      enabled: true,
      templateId: 7,
    });
    await expect(setOutreachTemplateEnabled(7, false)).resolves.toEqual({
      enabled: false,
      templateId: 7,
    });
    await expect(setOutreachTemplateEnabled(8, true)).resolves.toEqual({
      enabled: true,
      templateId: 8,
    });
    await expect(setOutreachTemplateEnabled(404, false)).resolves.toBeNull();
  });
});
