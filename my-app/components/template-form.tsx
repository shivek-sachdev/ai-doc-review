"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { TemplateNodeBuilder } from "@/components/template-node-builder"
import { AIContentGenerator } from "@/components/ai-content-generator"
import type { DocumentNode } from "@/lib/db"

interface TemplateFormProps {
  templateId?: string
}

interface TemplateNodeData {
  node_id: string
  sequence_order: number
  ai_instructions: string
}

export function TemplateForm({ templateId }: TemplateFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: "",
    description: "",
  })
  const [templateNodes, setTemplateNodes] = useState<TemplateNodeData[]>([])
  const [availableNodes, setAvailableNodes] = useState<DocumentNode[]>([])

  useEffect(() => {
    loadAvailableNodes()
    if (templateId) {
      loadTemplate()
    }
  }, [templateId])

  async function loadAvailableNodes() {
    try {
      const response = await fetch("/api/nodes")
      if (response.ok) {
        const nodes = await response.json()
        setAvailableNodes(nodes)
      }
    } catch (error) {
      console.error("Failed to load nodes:", error)
    }
  }

  async function loadTemplate() {
    try {
      const response = await fetch(`/api/templates/${templateId}`)
      if (response.ok) {
        const data = await response.json()
        setFormData({
          name: data.template.name,
          description: data.template.description || "",
        })
        setTemplateNodes(data.nodes || [])
      }
    } catch (error) {
      console.error("Failed to load template:", error)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (templateNodes.length === 0) {
      alert("Please add at least one node to the template")
      return
    }

    setLoading(true)

    try {
      const url = templateId ? `/api/templates/${templateId}` : "/api/templates"
      const method = templateId ? "PUT" : "POST"

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          nodes: templateNodes,
        }),
      })

      if (response.ok) {
        router.push("/templates")
      } else {
        alert("Failed to save template")
      }
    } catch (error) {
      console.error("Failed to save template:", error)
      alert("Failed to save template")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card className="p-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Template Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Standard Research Report, Business Proposal Review"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <div className="relative">
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of this template's purpose"
                rows={3}
                className="pr-10"
              />
              <AIContentGenerator
                value={formData.description}
                type="description"
                contextInfo={{ templateName: formData.name }}
                onGenerate={(content) => setFormData({ ...formData, description: content })}
              />
            </div>
          </div>
        </div>
      </Card>

      <TemplateNodeBuilder
        availableNodes={availableNodes}
        templateNodes={templateNodes}
        onTemplateNodesChange={setTemplateNodes}
      />

      <div className="flex gap-4">
        <Button type="submit" disabled={loading} size="lg">
          {loading ? "Saving..." : templateId ? "Update Template" : "Create Template"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.push("/templates")} size="lg">
          Cancel
        </Button>
      </div>
    </form>
  )
}
