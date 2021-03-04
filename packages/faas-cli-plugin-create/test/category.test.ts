import { CategorySelect } from '../src/categorySelect';
import * as assert from 'assert';

describe('/test/category.test.ts', () => {
  it('categorySelect', async () => {
    const category = new CategorySelect({
      groupChoices: {
        groupA: {
          desc: '1',
        },
        groupB: {
          desc: 'b',
        },
      },
      choicesHeader: {},
      show: false,
    });
    await category.initialize();
    category.toggle(category.choices[0], true);
    await category.submit();
    category.format();
    assert(category.selected.name === 'groupA - 1');
  });
});
