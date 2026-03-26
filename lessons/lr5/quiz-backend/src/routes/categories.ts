import { Hono } from 'hono'
import prisma from '../lib/prisma.js'

const categories = new Hono()

// GET /api/categories - Получить список всех категорий
categories.get('/', async (c) => {
  const allCategories = await prisma.category.findMany({
    // Оптимизация (Checkpoint 6): берем только нужные поля
    select: {
      id: true,
      name: true,
      _count: {
        select: { questions: true } // Показываем, сколько вопросов в каждой теме
      }
    }
  })

  return c.json({
    success: true,
    categories: allCategories
  })
})

export default categories