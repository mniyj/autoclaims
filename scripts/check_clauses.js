
import fs from 'fs';
import path from 'path';

const filePath = path.join(process.cwd(), 'jsonlist', 'clauses.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('Total clauses:', data.length);
data.forEach((clause, index) => {
    if (!clause.regulatoryName) {
        console.log(`Clause at index ${index} has no regulatoryName:`, clause);
    }
});
