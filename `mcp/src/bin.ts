import { searchWikiPage } from '../client';

const search = async (slug: string) => {
  try {
    const page = await searchWikiPage(slug);
    console.log(page);
  } catch (error) {
    console.error(error);
  }
};

if (process.argv.length !== 3) {
  console.log('Usage: node bin.ts <slug>');
  process.exit(1);
}

const slug = process.argv[2];
search(slug);
