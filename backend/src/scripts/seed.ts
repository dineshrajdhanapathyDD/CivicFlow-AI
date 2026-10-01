// Seed realistic demo data into the deployed CivicFlow table.
// Runs the FULL pipeline per report (AI analysis + clustering + priority) so the
// dashboard, issues, and duplicate clusters all populate with real values.
//
// Usage (PowerShell):
//   $env:AWS_REGION="us-east-1"; $env:DYNAMODB_TABLE="civicflow"; `
//   $env:IMAGES_BUCKET="<bucket>"; $env:BEDROCK_MODEL_ID="amazon.nova-lite-v1:0"; `
//   npm run seed
import { createReport } from '../services/reports.js';
import { analyzeReport } from '../services/analyze.js';
import type { CreateReportInput } from '../shared/schemas.js';

// Demo data set in Bengaluru, India. The first three reports are deliberately
// similar -> they must cluster into ONE community issue.
const SEED: CreateReportInput[] = [
  {
    title: 'Big pothole near school gate in Indiranagar',
    text: 'There is a large, deep pothole right outside the school gate on 100 Feet Road, Indiranagar. Auto-rickshaws swerve around it and it is dangerous for school children.',
    category: 'road_infrastructure',
    location: { label: 'Govt School gate, 100 Feet Road, Indiranagar, Bengaluru', lat: 12.9719, lng: 77.6412 },
  },
  {
    title: 'Deep hole beside school entrance, Indiranagar',
    text: 'A deep road hole has formed beside the school entrance near 100 Feet Road. It gets much worse after the monsoon rain and a two-wheeler nearly skidded.',
    category: 'road_infrastructure',
    location: { label: '100 Feet Road near Govt School, Indiranagar, Bengaluru', lat: 12.9721, lng: 77.6414 },
  },
  {
    title: 'Damaged road directly outside government school',
    text: 'The road surface directly outside the government school in Indiranagar is badly damaged with a large pothole. BBMP should repair it urgently.',
    category: 'road_infrastructure',
    location: { label: '100 Feet Road, Indiranagar, Bengaluru', lat: 12.9718, lng: 77.641 },
  },
  {
    title: 'Streetlight not working near Jayanagar park',
    text: 'The streetlight near the Jayanagar 4th Block park has not worked for three nights. The stretch is very dark and feels unsafe for women and children walking home.',
    category: 'streetlight',
    location: { label: 'Jayanagar 4th Block, near park, Bengaluru', lat: 12.925, lng: 77.5938 },
  },
  {
    title: 'Two lamp posts dark on 11th Main, Jayanagar',
    text: 'Two lamp posts on 11th Main Road, Jayanagar have been out for about a week. The whole stretch is dark at night.',
    category: 'streetlight',
    location: { label: '11th Main Road, Jayanagar, Bengaluru', lat: 12.9252, lng: 77.594 },
  },
  {
    title: 'Garbage not cleared near KR Market',
    text: 'Garbage bins near KR Market are overflowing and waste is spreading onto the footpath. It has not been cleared for several days and smells badly.',
    category: 'waste',
    location: { label: 'KR Market, Bengaluru', lat: 12.9608, lng: 77.5786 },
  },
  {
    title: 'Water pipeline leak flooding the road in BTM Layout',
    text: 'A BWSSB water pipeline appears to be leaking and water is flooding the road in BTM Layout 2nd Stage. It has been running and wasting water for two days.',
    category: 'water',
    location: { label: 'BTM Layout 2nd Stage, Bengaluru', lat: 12.9166, lng: 77.6101 },
  },
  {
    title: 'Blocked stormwater drain causing waterlogging in Koramangala',
    text: 'The stormwater drain at the Koramangala 5th Block junction is blocked with silt and plastic, causing severe waterlogging across the road after rain.',
    category: 'drainage',
    location: { label: 'Koramangala 5th Block junction, Bengaluru', lat: 12.9352, lng: 77.6245 },
  },
  {
    title: 'Broken bench in Cubbon Park',
    text: 'A wooden bench on the east path of Cubbon Park is broken with sharp edges sticking out. A visitor could get hurt.',
    category: 'public_property',
    location: { label: 'Cubbon Park, east path, Bengaluru', lat: 12.9763, lng: 77.5929 },
  },
];

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log(`Seeding ${SEED.length} demo reports into ${process.env.DYNAMODB_TABLE}…\n`);
  let analyzed = 0;
  for (const [i, input] of SEED.entries()) {
    const { report } = await createReport(input);
    console.log(`[${i + 1}/${SEED.length}] created ${report.reportId} — "${report.title}"`);
    try {
      const res = await analyzeReport(report.reportId);
      const issueId = res?.report.issueId;
      const sev = res?.report.severity;
      console.log(`         analyzed → severity=${sev} issue=${issueId}`);
      analyzed++;
    } catch (err) {
      console.warn(`         analyze failed (non-fatal): ${(err as Error).message}`);
    }
    // Gentle pacing so Bedrock throttling is unlikely during the demo seed.
    await sleep(800);
  }
  console.log(`\nDone. ${analyzed}/${SEED.length} reports analyzed and clustered.`);
  console.log('Tip: the three pothole reports should share one community issue.');
}

main().catch((e) => {
  console.error('Seed failed:', e);
  process.exit(1);
});
