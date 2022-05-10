var obj = {
    'id': 409174,
    'apikey': 'ODg4ODc2ZjI1ODUzODUxNTRmNzlmYTE1',
    'apihash': 'NTA4Njk1MTY3YjIyZDRlNmI5MDE1ZDg3ZTMzM2JjM2I1N2I5NDgzYjM5M2MyOTE3',
    'front': 1,
    'back': 0,
    'brand_id': 1,
    'product_id': 1,
    'size_id': 1,
    'color_id': 3
  },
res = Object.keys(obj).filter(v => /_id\b/.test(v))
.filter(key => key in obj) // line can be removed to make it inclusive
.reduce((obj2, key) => (obj2[key] = obj[key], obj2), {});

console.log(res);
