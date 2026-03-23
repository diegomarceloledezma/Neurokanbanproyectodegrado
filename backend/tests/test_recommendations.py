def test_get_task_recommendations_returns_top_candidates(client):
    response = client.get("/recommendations/tasks/1?strategy=balance")

    assert response.status_code == 200

    data = response.json()

    assert data["task_id"] == 1
    assert data["task_title"] == "Diseñar modelo de base de datos"
    assert data["strategy"] == "balance"
    assert "recommendations" in data
    assert len(data["recommendations"]) >= 1
    assert len(data["recommendations"]) <= 3

    first = data["recommendations"][0]
    assert "member" in first
    assert "score" in first
    assert "reason" in first
    assert "availability" in first
    assert "current_load" in first
    assert "risk_level" in first
    assert "active_tasks" in first


def test_get_task_simulation_returns_projected_metrics(client):
    response = client.get("/recommendations/tasks/1/simulation?strategy=balance")

    assert response.status_code == 200

    data = response.json()

    assert data["task_id"] == 1
    assert data["strategy"] == "balance"
    assert "simulations" in data
    assert len(data["simulations"]) >= 1
    assert len(data["simulations"]) <= 3

    first = data["simulations"][0]
    assert first["projected_load"] >= first["current_load"]
    assert first["projected_active_tasks"] >= first["current_active_tasks"]
    assert "estimated_hours_impact" in first
    assert "risk_level" in first
    assert "reason" in first


def test_get_task_insights_returns_intelligent_analysis(client):
    response = client.get("/recommendations/tasks/1/insights")

    assert response.status_code == 200

    data = response.json()

    assert data["task_id"] == 1
    assert data["task_title"] == "Diseñar modelo de base de datos"
    assert data["suggested_strategy"] in ["balance", "efficiency", "urgency", "learning"]
    assert isinstance(data["suggested_strategy_label"], str)
    assert isinstance(data["suggested_area"], str)
    assert isinstance(data["suggested_skills"], list)
    assert len(data["suggested_skills"]) >= 1
    assert isinstance(data["detected_signals"], list)
    assert len(data["detected_signals"]) >= 1
    assert isinstance(data["explanation"], str)