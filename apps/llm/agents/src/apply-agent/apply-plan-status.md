•	TS side planning: good
	•	Python runner contract: good
	•	Provider-specific execution shell: ready to refactor
	•	Real browser automation: not yet wired

	•	apps/llm/agents/scripts/apply-agent/run-nova.py → entrypoint only
	•	apps/llm/agents/src/apply-agent/nova_runner.py → orchestration
	•	apps/llm/agents/src/apply-agent/providers/greenhouse.py → Greenhouse actions
	•	apps/llm/agents/src/apply-agent/providers/workday.py → Workday actions
	•	apps/llm/agents/src/apply-agent/providers/ashby.py → Ashby actions