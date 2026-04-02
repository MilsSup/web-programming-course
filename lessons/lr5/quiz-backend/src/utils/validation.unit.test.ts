import { describe, it, expect } from 'vitest'
import { QuestionSchema } from './validation.js'

describe('Validation Schema: Question', () => {
  it('should validate a correct multiple-select question', () => {
    const validQuestion = {
      text: "Как дела?",
      type: "multiple-select",
      points: 10,
      categoryId: "cat123",
      options: ["Хорошо", "Плохо"],
      correctAnswer: ["Хорошо"]
    }
    const result = QuestionSchema.safeParse(validQuestion)
    expect(result.success).toBe(true)
  })
  
  it('should validate a correct essay question', () => {
    const validEssay = {
      text: "Опишите принципы SOLID",
      type: "essay",
      points: 15,
      categoryId: "cat456"
    }
    const result = QuestionSchema.safeParse(validEssay)
    expect(result.success).toBe(true)
  })

  it('should fail if multiple-select question has no options', () => {
    const invalidQuestion = {
      text: "Где варианты?",
      type: "multiple-select",
      points: 5,
      categoryId: "cat123",
      // options отсутствуют
      correctAnswer: ["A"]
    }
    const result = QuestionSchema.safeParse(invalidQuestion)
    expect(result.success).toBe(false)
  })

  it('should fail if points are out of range (more than 100)', () => {
    const invalidQuestion = {
      text: "Слишком дорогой вопрос",
      type: "essay",
      points: 999, // Максимум 100
      categoryId: "cat123"
    }
    const result = QuestionSchema.safeParse(invalidQuestion)
    expect(result.success).toBe(false)
  })

  it('should fail if text is too short', () => {
    const invalidQuestion = {
      text: "Ой", // Меньше 3 символов
      type: "multiple-select",
      points: 5,
      categoryId: "cat123"
    }
    const result = QuestionSchema.safeParse(invalidQuestion)
    expect(result.success).toBe(false)
  })
})