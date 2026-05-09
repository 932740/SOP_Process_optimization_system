import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Card, Button, Input, List, Space, message, Modal, Select, Row, Col,
  Upload, Image, Divider, Tooltip, Popconfirm, Spin,
} from 'antd'
import {
  PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined,
  RobotOutlined, SaveOutlined, CheckCircleOutlined, ArrowLeftOutlined,
  ClearOutlined,
} from '@ant-design/icons'
import { documentApi, stepApi, adminApi, uploadApi } from '../services/api'
import type { UploadFile } from 'antd/es/upload/interface'

interface Step {
  id: number
  step_no: number
  title: string
  description: string
  image_urls: string[]
  ai_optimized_desc: string | null
  optimization_type: string | null
}

interface AiModel {
  id: number
  name: string
  provider: string
  is_active?: number
}

function DocumentEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [doc, setDoc] = useState<any>(null)
  const [steps, setSteps] = useState<Step[]>([])
  const [activeStepId, setActiveStepId] = useState<number | null>(null)
  const [aiModalOpen, setAiModalOpen] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiModels, setAiModels] = useState<AiModel[]>([])
  const [selectedModel, setSelectedModel] = useState<number | undefined>()
  const [optimizationType, setOptimizationType] = useState('text_polish')
  const [aiResult, setAiResult] = useState('')
  const [saving, setSaving] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deptOptions, setDeptOptions] = useState<{ value: string; label: string }[]>([])

  // 本地草稿：避免输入时直接调 API 导致闪烁
  const draftsRef = useRef<Record<number, Partial<Step>>>({})
  const [drafts, setDrafts] = useState<Record<number, Partial<Step>>>({})
  const saveTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const activeStep = steps.find((s) => s.id === activeStepId)

  useEffect(() => {
    if (id) {
      fetchDocument(+id)
    }
    fetchAiModels()
    fetchDeptFormats()
  }, [id])

  const fetchDeptFormats = async () => {
    try {
      const res = await adminApi.getDepartmentFormats()
      setDeptOptions(res.data.map((d: any) => ({ value: d.department_name, label: d.department_name })))
    } catch (err) {
      console.error('Failed to fetch department formats')
    }
  }

  const fetchDocument = async (docId: number) => {
    try {
      const res = await documentApi.get(docId)
      setDoc(res.data)
      setSteps(res.data.steps || [])
      if (res.data.steps?.length) {
        setActiveStepId(res.data.steps[0].id)
      }
    } catch (err) {
      message.error('获取文档失败')
    }
  }

  const fetchAiModels = async () => {
    try {
      const res = await adminApi.getActiveAiModels()
      const active = res.data
      setAiModels(active)
    } catch (err) {
      console.error('Failed to fetch AI models')
    }
  }

  // 获取步骤字段：优先读草稿，没有草稿则读 steps 中的数据
  const getField = useCallback((stepId: number, field: keyof Step) => {
    const draft = drafts[stepId]
    if (draft && field in draft) {
      return draft[field] as any
    }
    const step = steps.find((s) => s.id === stepId)
    return step ? step[field] : ''
  }, [drafts, steps])

  // 字段变更：只更新草稿 + 防抖自动保存
  const handleFieldChange = (stepId: number, field: keyof Step, value: any) => {
    draftsRef.current = {
      ...draftsRef.current,
      [stepId]: { ...draftsRef.current[stepId], [field]: value },
    }
    setDrafts({ ...draftsRef.current })

    if (saveTimers.current[stepId]) {
      clearTimeout(saveTimers.current[stepId])
    }

    saveTimers.current[stepId] = setTimeout(() => {
      const data = draftsRef.current[stepId]
      if (!data || Object.keys(data).length === 0) return
      stepApi
        .update(stepId, data)
        .then((res: any) => {
          setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...res.data } : s)))
          draftsRef.current = { ...draftsRef.current }
          delete draftsRef.current[stepId]
          setDrafts({ ...draftsRef.current })
        })
        .catch(() => {
          message.error('自动保存失败')
        })
    }, 800)
  }

  // 立即保存指定步骤的草稿
  const flushDraft = async (stepId: number) => {
    if (saveTimers.current[stepId]) {
      clearTimeout(saveTimers.current[stepId])
      delete saveTimers.current[stepId]
    }
    const data = draftsRef.current[stepId]
    if (!data || Object.keys(data).length === 0) return
    try {
      const res = await stepApi.update(stepId, data)
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...res.data } : s)))
      draftsRef.current = { ...draftsRef.current }
      delete draftsRef.current[stepId]
      setDrafts({ ...draftsRef.current })
    } catch (err) {
      message.error('保存步骤失败')
      throw err
    }
  }

  const handleAddStep = async () => {
    if (!id) return
    try {
      const res = await stepApi.create(+id, { title: '', description: '' })
      const newStep = res.data
      setSteps([...steps, newStep])
      setActiveStepId(newStep.id)
    } catch (err) {
      message.error('添加步骤失败')
    }
  }

  const handleUpdateStep = async (stepId: number, data: Partial<Step>) => {
    try {
      const res = await stepApi.update(stepId, data)
      setSteps((prev) => prev.map((s) => (s.id === stepId ? { ...s, ...res.data } : s)))
    } catch (err) {
      message.error('保存步骤失败')
    }
  }

  const handleDeleteStep = async (stepId: number) => {
    try {
      await stepApi.remove(stepId)
      setSteps(steps.filter((s) => s.id !== stepId))
      if (activeStepId === stepId) {
        setActiveStepId(null)
      }
    } catch (err) {
      message.error('删除步骤失败')
    }
  }

  const handleMoveStep = (index: number, direction: number) => {
    const newIndex = index + direction
    if (newIndex < 0 || newIndex >= steps.length) return
    const newSteps = [...steps]
    const [removed] = newSteps.splice(index, 1)
    newSteps.splice(newIndex, 0, removed)
    setSteps(newSteps.map((s, i) => ({ ...s, step_no: i + 1 })))
  }

  const handleAiOptimize = async () => {
    if (!activeStep) return
    setAiLoading(true)
    try {
      const res = await stepApi.aiOptimize(activeStep.id, {
        modelId: selectedModel,
        optimizationType: optimizationType,
      })
      setAiResult(res.data.result)
      message.success('AI优化完成')
    } catch (err: any) {
      message.error(err.response?.data?.message || 'AI优化失败')
    } finally {
      setAiLoading(false)
    }
  }

  const handleApplyAiResult = () => {
    if (!activeStep || !aiResult) return
    handleUpdateStep(activeStep.id, {
      ai_optimized_desc: aiResult,
      optimization_type: optimizationType,
      description: aiResult,
    })
    setAiModalOpen(false)
    setAiResult('')
  }

  const handleClearAiResult = async () => {
    if (!activeStep) return
    try {
      await handleUpdateStep(activeStep.id, { ai_optimized_desc: null, optimization_type: null })
      message.success('已清除AI优化结果')
    } catch (err) {
      message.error('清除失败')
    }
  }

  const handleSubmit = async () => {
    if (!id) return
    // 提交前先保存当前步骤草稿
    if (activeStepId !== null) {
      await flushDraft(activeStepId)
    }
    setSubmitting(true)
    try {
      await documentApi.submit(+id)
      message.success('提交成功，文档已归档')
      navigate('/')
    } catch (err: any) {
      message.error(err.response?.data?.message || '提交失败')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSaveDoc = async () => {
    if (!id || !doc) return
    setSaving(true)
    try {
      await documentApi.update(+id, { title: doc.title, doc_type: doc.doc_type })
      message.success('保存成功')
    } catch (err) {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  // 切换步骤时，先保存旧步骤的草稿
  const handleSelectStep = (stepId: number) => {
    if (activeStepId !== null && activeStepId !== stepId) {
      flushDraft(activeStepId).catch(() => {})
    }
    setActiveStepId(stepId)
  }

  if (!doc) return <Spin style={{ display: 'block', margin: '100px auto' }} />

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col flex="auto">
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>
              返回
            </Button>
            <Input
              value={doc.title}
              onChange={(e) => setDoc({ ...doc, title: e.target.value })}
              style={{ width: 300 }}
              placeholder="文档名称"
            />
            <Select
              value={doc.doc_type}
              onChange={(v) => setDoc({ ...doc, doc_type: v })}
              style={{ width: 150 }}
              placeholder="所属部门"
              options={deptOptions}
            />
          </Space>
        </Col>
        <Col>
          <Space>
            <Button icon={<SaveOutlined />} loading={saving} onClick={handleSaveDoc}>
              保存
            </Button>
            <Button type="primary" icon={<CheckCircleOutlined />} loading={submitting} onClick={handleSubmit}>
              提交
            </Button>
          </Space>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={6}>
          <Card
            title="操作步骤"
            extra={
              <Button icon={<PlusOutlined />} size="small" onClick={handleAddStep}>
                添加步骤
              </Button>
            }
          >
            <List
              dataSource={steps}
              renderItem={(item, index) => (
                <List.Item
                  style={{
                    cursor: 'pointer',
                    background: activeStepId === item.id ? '#e6f7ff' : 'transparent',
                    padding: '8px 12px',
                    borderRadius: 4,
                  }}
                  onClick={() => handleSelectStep(item.id)}
                  actions={[
                    <Tooltip title="上移">
                      <ArrowUpOutlined onClick={(e) => { e.stopPropagation(); handleMoveStep(index, -1) }} />
                    </Tooltip>,
                    <Tooltip title="下移">
                      <ArrowDownOutlined onClick={(e) => { e.stopPropagation(); handleMoveStep(index, 1) }} />
                    </Tooltip>,
                    <Popconfirm title="删除此步骤？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteStep(item.id) }}>
                      <DeleteOutlined style={{ color: '#ff4d4f' }} />
                    </Popconfirm>,
                  ]}
                >
                  <div>
                    <div style={{ fontWeight: 'bold' }}>步骤 {item.step_no}</div>
                    <div style={{ color: '#666', fontSize: 12 }}>{item.title || '未命名'}</div>
                  </div>
                </List.Item>
              )}
            />
          </Card>
        </Col>

        <Col span={18}>
          {activeStep ? (
            <Card
              title={`编辑步骤 ${activeStep.step_no}`}
              extra={
                <Button icon={<RobotOutlined />} onClick={() => setAiModalOpen(true)}>
                  AI优化
                </Button>
              }
            >
              <Space direction="vertical" style={{ width: '100%' }} size="large">
                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>步骤标题</label>
                  <Input
                    value={getField(activeStep.id, 'title')}
                    onChange={(e) => handleFieldChange(activeStep.id, 'title', e.target.value)}
                    placeholder="输入步骤标题"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>原始描述</label>
                  <Input.TextArea
                    rows={4}
                    value={getField(activeStep.id, 'description')}
                    onChange={(e) => handleFieldChange(activeStep.id, 'description', e.target.value)}
                    placeholder="输入操作步骤描述"
                  />
                </div>

                <div>
                  <label style={{ display: 'block', marginBottom: 8, fontWeight: 'bold' }}>步骤图片</label>
                  <Space wrap>
                    {(activeStep.image_urls || []).map((url, idx) => (
                      <Image key={idx} src={url} width={120} style={{ borderRadius: 4 }} />
                    ))}
                    <Upload
                      customRequest={async ({ file, onSuccess, onError }) => {
                        try {
                          const res = await uploadApi.uploadImage(file as File)
                          const url = res.data.url
                          const newUrls = [...(activeStep.image_urls || []), url]
                          await handleUpdateStep(activeStep.id, { image_urls: newUrls })
                          onSuccess?.(res.data)
                        } catch (err: any) {
                          message.error(err.response?.data?.message || '上传失败')
                          onError?.(err)
                        }
                      }}
                      showUploadList={false}
                    >
                      <Button icon={<PlusOutlined />} size="small">上传图片</Button>
                    </Upload>
                  </Space>
                </div>

                {activeStep.ai_optimized_desc && (
                  <div style={{ background: '#f6ffed', padding: 16, borderRadius: 4, border: '1px solid #b7eb8f' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <label style={{ fontWeight: 'bold', color: '#52c41a' }}>
                        AI优化结果（{activeStep.optimization_type}）
                      </label>
                      <Button
                        size="small"
                        danger
                        icon={<ClearOutlined />}
                        onClick={handleClearAiResult}
                      >
                        清除优化结果
                      </Button>
                    </div>
                    <Input.TextArea
                      rows={4}
                      value={getField(activeStep.id, 'ai_optimized_desc') ?? ''}
                      onChange={(e) => handleFieldChange(activeStep.id, 'ai_optimized_desc', e.target.value)}
                    />
                  </div>
                )}
              </Space>
            </Card>
          ) : (
            <Card>
              <div style={{ textAlign: 'center', color: '#999' }}>请选择或创建一个步骤</div>
            </Card>
          )}
        </Col>
      </Row>

      <Modal
        title="AI优化"
        open={aiModalOpen}
        onCancel={() => { setAiModalOpen(false); setAiResult('') }}
        width={800}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={16}>
            <Col span={12}>
              <label>AI模型</label>
              <Select
                style={{ width: '100%' }}
                placeholder="选择AI模型"
                value={selectedModel}
                onChange={setSelectedModel}
                options={aiModels.map((m) => ({ value: m.id, label: m.name }))}
              />
            </Col>
            <Col span={12}>
              <label>优化类型</label>
              <Select
                style={{ width: '100%' }}
                value={optimizationType}
                onChange={setOptimizationType}
                options={[
                  { value: 'text_polish', label: '文字润色' },
                  { value: 'image_completion', label: '图片理解补全' },
                  { value: 'checkpoint_supplement', label: '规范检查点补充' },
                ]}
              />
            </Col>
          </Row>

          <Button type="primary" loading={aiLoading} onClick={handleAiOptimize} block>
            开始优化
          </Button>

          {aiResult && (
            <>
              <Divider />
              <div>
                <label style={{ fontWeight: 'bold' }}>优化结果</label>
                <Input.TextArea rows={6} value={aiResult} onChange={(e) => setAiResult(e.target.value)} />
              </div>
              <Button type="primary" onClick={handleApplyAiResult} block>
                采用此结果
              </Button>
            </>
          )}
        </Space>
      </Modal>
    </div>
  )
}

export default DocumentEditor
