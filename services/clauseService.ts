
import { MOCK_CLAUSES } from '../constants';
import { type Clause } from '../types';

export const searchClauses = async (query: string): Promise<Clause[]> => {
  console.log(`Searching for: "${query}"`);

  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 300));

  if (!query) {
    return [];
  }

  const lowerCaseQuery = query.toLowerCase();
  return MOCK_CLAUSES.filter(clause =>
    clause.regulatoryName.toLowerCase().includes(lowerCaseQuery) ||
    clause.productCode.toLowerCase().includes(lowerCaseQuery)
  );
};
