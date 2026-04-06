import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMoodboardPromptFromShoppingItems,
  selectShoppingItemsForMoodboard,
  toShoppingReferenceImages,
} from "../../convex/ai/helpers/shoppingMoodboard.ts";

test("selectShoppingItemsForMoodboard keeps imaged preferred items and applies section/set filters", () => {
  const selected = selectShoppingItemsForMoodboard(
    [
      {
        _id: "item-1",
        name: "Boucle sofa",
        sectionName: "Living Room",
        setTitle: "Seating",
        imageUrl: "https://cdn.example.com/sofa.jpg",
        isPreferredInSet: true,
      },
      {
        _id: "item-2",
        name: "Accent chair",
        sectionName: "Living Room",
        setTitle: "Seating",
        imageUrl: "https://cdn.example.com/chair.jpg",
        isPreferredInSet: false,
      },
      {
        _id: "item-3",
        name: "Kitchen stool",
        sectionName: "Kitchen",
        setTitle: "Bar",
        imageUrl: "https://cdn.example.com/stool.jpg",
        isPreferredInSet: true,
      },
      {
        _id: "item-4",
        name: "Lamp without image",
        sectionName: "Living Room",
        setTitle: "Lighting",
      },
    ],
    {
      sectionName: "living",
      setName: "seat",
      onlySetPreferredItems: true,
      maxItems: 5,
    },
  );

  assert.deepEqual(selected.map((item) => item._id), ["item-1"]);
});

test("buildMoodboardPromptFromShoppingItems adds shopping context and reference item list", () => {
  const prompt = buildMoodboardPromptFromShoppingItems(
    "Create a soft modern living room moodboard.",
    [
      {
        _id: "item-1",
        name: "Boucle sofa",
        category: "Sofa",
        supplier: "Nordic Home",
        sectionName: "Living Room",
        imageUrl: "https://cdn.example.com/sofa.jpg",
      },
    ],
    {
      sectionName: "Living Room",
      query: "soft modern",
    },
  );

  assert.match(prompt, /Use the attached shopping item images/);
  assert.match(prompt, /Boucle sofa/);
  assert.match(prompt, /Focus shopping section: Living Room/);
  assert.match(prompt, /Focus query\/theme: soft modern/);
});

test("toShoppingReferenceImages returns only items with usable image urls", () => {
  const references = toShoppingReferenceImages(
    [
      {
        _id: "item-1",
        name: "Boucle sofa",
        imageUrl: " https://cdn.example.com/sofa.jpg ",
      },
      {
        _id: "item-2",
        name: "No image",
      },
    ],
    6,
  );

  assert.deepEqual(references, [
    {
      name: "Boucle sofa",
      imageUrl: "https://cdn.example.com/sofa.jpg",
    },
  ]);
});
