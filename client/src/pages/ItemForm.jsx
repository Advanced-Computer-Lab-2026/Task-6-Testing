import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'

const defaults = { title: '', description: '', category: 'other', status: 'lost', location: '' } //test 1 default values


const statuses = ['lost', 'found', 'claimed']
const categories = ['electronics', 'clothing', 'documents', 'accessories', 'other']

export default function ItemForm() {
  const nav = useNavigate()
  const { id } = useParams()
  const [form, setForm] = useState(defaults)
  const [error, setError] = useState('')

  // Edit mode: load the item and fill the form with its editable fields.
  useEffect(() => {
    if (!id) return
    api.get(`/items/${id}`)
      .then(({ data }) => {
        const { title, status, category, location, description } = data.item
        setForm({
          title,
          status,
          category,
          location: location || '',
          description: description || ''
        })
      })
      .catch(err => setError(err?.response?.data?.message || 'Failed to load item'))
  }, [id])

  function onChange(e) {
    const { name, value } = e.target
    setForm(f => ({ ...f, [name]: value }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    setError('')
    const { title, status, category, location, description } = form // test 2 validate form data
    const body = { title, status, category, location, description }
    try {
      if (id) await api.patch(`/items/${id}`, body)
      else await api.post('/items', body)
      nav('/items')
    } catch (err) {
      setError(err?.response?.data?.message || 'Save failed')
    }
  }

  return (
    <div className="max-w-lg mx-auto card">
      <h1 className="text-xl font-semibold mb-4">{id ? 'Edit' : 'Report'} Item</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input className="input" name="title" placeholder="Title (e.g. Black backpack)" value={form.title} onChange={onChange} />
        <select className="input" name="status" value={form.status} onChange={onChange}>
          {statuses.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="input" name="category" value={form.category} onChange={onChange}>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <input className="input" name="location" placeholder="Location (e.g. Library 2nd floor)" value={form.location} onChange={onChange} />
        <textarea className="input" name="description" placeholder="Description" rows={4} value={form.description} onChange={onChange} />
        {error && <div className="text-red-600 text-sm">{error}</div>}
        <button className="btn" type="submit">Save</button>
      </form>
    </div>
  )
}
