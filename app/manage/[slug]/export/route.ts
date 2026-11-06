import { canManage } from '@/lib/access';
import { getBundle, getEventBySlug } from '@/lib/data';
import { slugify } from '@/lib/format';

export const dynamic = 'force-dynamic';

/** Quote a value for CSV, and neutralize spreadsheet formulas (=, +, -, @). */
function cell(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const key = new URL(req.url).searchParams.get('key');
  const event = await getEventBySlug(slug);
  if (!event || !(await canManage(event, key))) return new Response('Not found', { status: 404 });

  const { teams, players } = await getBundle(event);
  const teamOf = (id: number | null) => teams.find((t) => t.id === id);
  const header = [
    'Name', 'Email', 'Team', 'Signed up as', 'Position', 'Skill', 'Picked team', 'Playing in honor of',
    'Paid', 'Checked in', 'Waiver agreed', 'Waiver signed by', 'Raised ($)', 'Goal ($)', 'Distance', 'Team captain', 'Captain email', 'Jersey size', 'Jersey number', 'Pay link',
  ];
  const rows = players.map((p) => {
    const t = teamOf(p.team_id);
    const paid = p.is_solo ? p.paid : Boolean(t?.paid);
    return [
      p.name, p.email, t?.name ?? '', p.is_solo ? 'Solo' : 'With a team', p.position, p.is_solo ? p.skill : '', p.choice,
      p.honoring, paid ? 'Yes' : 'No', p.checked_in ? 'Yes' : 'No',
      p.waiver_agreed_at ? new Date(p.waiver_agreed_at).toLocaleString('en-US', { timeZone: 'America/Chicago' }) : '',
      p.waiver_name, (p.raised / 100).toFixed(2), (p.goal / 100).toFixed(2), p.distance ?? '',
      t?.origin === 'registered' ? t.captain_name : '', t?.origin === 'registered' ? t.captain_email : '',
      p.jersey_size, p.jersey_number, p.pay_url,
    ];
  });
  const csv = '﻿' + [header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slugify(event.name)}-roster.csv"`,
      'Cache-Control': 'no-store',
    },
  });
}
