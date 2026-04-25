import 'dotenv/config';
import { addInternalLinks } from './linker';

async function test() {
  console.log('--- Testing Internal Linker ---');
  
  const mockBlocks = [
    { type: 'header', data: { text: 'כותרת מבחן', level: 1 } },
    { type: 'paragraph', data: { text: 'זוהי פסקת פתיחה שבה נדבר על כלכלה ועל שוק ההון בישראל.' } },
    { type: 'paragraph', data: { text: 'כאן נזכיר את מחירי הדיור ואת נושא המשכנתאות המעניין.' } },
    { type: 'paragraph', data: { text: 'לסיכום, המצב הכלכלי משפיע על כולם.' } }
  ];

  const title = 'כותרת המאמר החדש';
  const categorySlug = 'general';

  console.log('Original blocks:', JSON.stringify(mockBlocks, null, 2));

  try {
    const linkedBlocks = await addInternalLinks(mockBlocks, title, categorySlug);
    console.log('Linked blocks:', JSON.stringify(linkedBlocks, null, 2));
  } catch (error) {
    console.error('Error during test:', error);
  }
}

test();
