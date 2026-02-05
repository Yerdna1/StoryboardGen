/**
 * Default sample prompts that are loaded for new users
 */

const DEFAULT_PROMPTS = [
  {
    id: 'default-20-panel',
    title: '🎬 20-Panel Storyboard (Sample)',
    content: `1. Opening establishing shot - setting the scene
2. Main character introduction
3. Inciting incident - the problem emerges
4. Character's initial reaction
5. Decision to take action
6. Beginning the journey
7. First obstacle appears
8. Attempting to overcome it
9. Failure and setback
10. Moment of doubt
11. Finding new determination
12. Gaining allies or resources
13. Training or preparation
14. Setting out again
15. Climax approach - final challenge
16. Confronting the main conflict
17. Battle or struggle
18. Victory through character growth
19. Resolution and transformation
20. Closing shot - new beginning`,
    isDefault: true,
    description: 'Classic hero\'s journey structure - perfect for testing storyboards'
  },
  {
    id: 'default-8-panel',
    title: '🎞️ 8-Panel Commercial (Sample)',
    content: `1. Problem identification
2. Product reveal
3. Feature demonstration
4. Benefit showcase
5. Customer testimonial
6. Social proof
7. Call to action
8. Brand logo`,
    isDefault: true,
    description: 'Short commercial structure - great for quick projects'
  }
];

/**
 * Initialize default prompts if none exist
 */
async function initializeDefaultPrompts(db) {
  const existingPrompts = db.prepare('SELECT COUNT(*) as count FROM prompts').get();

  if (existingPrompts.count === 0) {
    console.log('Initializing default prompts for new user...');

    const insert = db.prepare(`
      INSERT INTO prompts (id, title, content, created_at)
      VALUES (?, ?, ?, ?)
    `);

    const transaction = db.transaction((prompts) => {
      for (const prompt of prompts) {
        insert.run(
          prompt.id,
          prompt.title,
          prompt.content,
          new Date().toISOString()
        );
      }
    });

    transaction(DEFAULT_PROMPTS);
    console.log(`✓ Initialized ${DEFAULT_PROMPTS.length} default prompts`);
  }
}

module.exports = {
  DEFAULT_PROMPTS,
  initializeDefaultPrompts
};
